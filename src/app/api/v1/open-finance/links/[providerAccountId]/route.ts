/**
 * `PUT, DELETE /api/v1/open-finance/links/{providerAccountId}` — vincular e
 * desvincular (ADR-0020 §3, PRD P50).
 *
 * The link date is the DAY the link is made (decisão do dono, 2026-09-29:
 * "ao invés de pegar lançamentos passados, vamos começar a pegar somente de
 * hoje em diante" — it used to be the first day of the month). Nothing before
 * it is imported. Re-linking keeps the original date — moving it would re-open
 * (or drop) what was already imported.
 *
 * A card starts the day after its last bill closed (owner's request,
 * 2026-10-01, `cardImportStart`): the bill still open is imported whole, so
 * its payment settles all of it.
 */

import {
  cardImportStart,
  type OpenFinanceAccountKind,
  type OpenFinanceLinkTarget,
  type ProviderAccountId,
} from '@/domain/open-finance'
import { asId, type BankAccountId, type InvestmentId } from '@/domain/core'
import { getOpenFinanceReader, getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, noContent, ok } from '@/api/http'
import { refreshLinkedBalance } from '@/api/open-finance'
import { openFinanceLinkBodySchema, providerAccountParams } from '@/api/contracts/open-finance'
import { todayIsoDate } from '@/lib/clock'

/** A checking account is a Conta Bancária, a card points at who pays it, an investment is an Investimento. */
const TARGET_FOR_KIND: Record<OpenFinanceAccountKind, OpenFinanceLinkTarget['kind']> = {
  Checking: 'BankAccount',
  CreditCard: 'CreditCard',
  Investment: 'Investment',
}

export const PUT = handler({
  operation: 'open_finance.link',
  params: providerAccountParams,
  body: openFinanceLinkBodySchema,
  handle: async ({ session, params, body }) => {
    const repos = getRepositories()
    const providerAccountId = params.providerAccountId as ProviderAccountId

    const accounts = await getOpenFinanceReader().listAccounts(session.userId)
    const account = accounts.find((a) => a.id === providerAccountId)
    if (account === undefined) throw new Error('open_finance.unknown_provider_account')
    if (TARGET_FOR_KIND[account.kind] !== body.target.kind) {
      throw new Error('open_finance.target_kind_mismatch')
    }

    const target: OpenFinanceLinkTarget =
      body.target.kind === 'Investment'
        ? { kind: 'Investment', investmentId: asId<InvestmentId>(body.target.investmentId) }
        : body.target.kind === 'CreditCard'
          ? {
              kind: 'CreditCard',
              paidByBankAccountId: asId<BankAccountId>(body.target.paidByBankAccountId),
            }
          : { kind: 'BankAccount', bankAccountId: asId<BankAccountId>(body.target.bankAccountId) }

    const exists =
      target.kind === 'Investment'
        ? (await repos.investmentReader.findById(session.userId, target.investmentId)) !== null
        : (await repos.bankAccountReader.findById(
            session.userId,
            target.kind === 'CreditCard' ? target.paidByBankAccountId : target.bankAccountId,
          )) !== null
    if (!exists) throw new NotFoundError('A posição informada para o vínculo não existe.')

    // Several provider accounts may point at one position and their balances
    // sum (rules.ts) — decided for investments and for checking accounts on
    // 2026-09-29, when one bank reported two products under the same number.
    const links = await repos.openFinanceLinkReader.list(session.userId)
    const previous = links.find((l) => l.providerAccountId === providerAccountId)
    const linkedOn =
      previous?.linkedOn ??
      (target.kind === 'CreditCard'
        ? cardImportStart(
            await getOpenFinanceReader().listBills(session.userId, providerAccountId),
            todayIsoDate(),
          )
        : todayIsoDate())
    const link = await repos.openFinanceLinkWriter.save(session.userId, {
      providerAccountId,
      target,
      linkedOn,
    })
    // O saldo do cadastro muda na hora, não na próxima sincronização.
    if (target.kind !== 'CreditCard') {
      await refreshLinkedBalance(repos, accounts, session.userId, target)
    }
    // Quem saiu deste vínculo para outro também precisa do saldo refeito.
    if (previous !== undefined && previous.target.kind !== 'CreditCard') {
      await refreshLinkedBalance(repos, accounts, session.userId, previous.target)
    }
    return ok({ ...account, link: { target: link.target, linkedOn: link.linkedOn } })
  },
})

export const DELETE = handler({
  operation: 'open_finance.unlink',
  params: providerAccountParams,
  handle: async ({ session, params }) => {
    const repos = getRepositories()
    const providerAccountId = params.providerAccountId as ProviderAccountId
    const removed = (await repos.openFinanceLinkReader.list(session.userId)).find(
      (l) => l.providerAccountId === providerAccountId,
    )
    await repos.openFinanceLinkWriter.remove(session.userId, providerAccountId)
    // Tira do saldo a parte da conta que saiu, somando as que continuam
    // (pedido do dono, 2026-09-29). Sem nenhuma restante, o último saldo fica.
    if (removed !== undefined && removed.target.kind !== 'CreditCard') {
      const accounts = await getOpenFinanceReader().listAccounts(session.userId)
      await refreshLinkedBalance(repos, accounts, session.userId, removed.target)
    }
    return noContent()
  },
})

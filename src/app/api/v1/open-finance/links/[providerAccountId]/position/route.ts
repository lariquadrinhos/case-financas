/**
 * `POST /api/v1/open-finance/links/{providerAccountId}/position` — "Criar e
 * vincular" (decisão do dono, 2026-09-29).
 *
 * The bank reported 8 checking accounts and 36 investments; typing each one
 * into Contas Bancárias or Investimentos just to link it back was the friction
 * this removes. The position is born with the bank's name and balance, in the
 * entity the person picks — the only thing the bank cannot answer without the
 * CPF/CNPJ, which Bigorna does not read (ADR-0020 §3).
 *
 * A card is refused: it is not a position, it points at the account that
 * pays it.
 */

import type { OpenFinanceAccount, ProviderAccountId } from '@/domain/open-finance'
import { getOpenFinanceReader, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { created, resourcePath } from '@/api/http'
import { providerAccountParams } from '@/api/contracts/open-finance'
import { createPositionBodySchema } from '@/api/contracts/open-finance'
import { suggestedColourFor } from '@/lib/bank-account-colours'
import { todayIsoDate } from '@/lib/clock'

export const POST = handler({
  operation: 'open_finance.create_position',
  params: providerAccountParams,
  body: createPositionBodySchema,
  handle: async ({ session, params, body }) => {
    const providerAccountId = params.providerAccountId as ProviderAccountId
    const accounts = await getOpenFinanceReader().listAccounts(session.userId)
    const account = accounts.find((a) => a.id === providerAccountId)
    if (account === undefined) throw new Error('open_finance.unknown_provider_account')
    if (account.kind === 'CreditCard') throw new Error('open_finance.target_kind_mismatch')

    // De hoje em diante (2026-09-29), como no vínculo pelo seletor.
    const linkedOn = todayIsoDate()
    const label = labelFor(account, accounts)

    return withTransaction(async (repos) => {
      if (account.kind === 'Checking') {
        const position = await repos.bankAccountWriter.create(session.userId, {
          label,
          // The same rule the manual form uses: same name, same colour (2026-09-29).
          colour: suggestedColourFor(label),
          entity: body.entity,
          balance: account.balance,
        })
        await repos.openFinanceLinkWriter.save(session.userId, {
          providerAccountId,
          target: { kind: 'BankAccount', bankAccountId: position.id },
          linkedOn,
        })
        return created(resourcePath('bank-accounts', position.id), position)
      }
      const position = await repos.investmentWriter.create(session.userId, {
        name: label,
        entity: body.entity,
        accumulatedValue: account.balance,
      })
      await repos.openFinanceLinkWriter.save(session.userId, {
        providerAccountId,
        target: { kind: 'Investment', investmentId: position.id },
        linkedOn,
      })
      return created(resourcePath('investments', position.id), position)
    })
  },
})

/**
 * O nome com que o cadastro nasce. Conta corrente leva o nome do BANCO
 * ("Nubank"), não o do produto: medido em 2026-09-29, o produto chegava como
 * "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)", que quebrava
 * em três linhas no seletor e não é como a pessoa chama a conta. Com mais de
 * uma conta corrente no mesmo banco, o final dos dígitos desempata. Investimento
 * guarda o nome do produto, que é o que distingue um CDB de uma caixinha.
 */
function labelFor(account: OpenFinanceAccount, all: readonly OpenFinanceAccount[]): string {
  const product = account.name.trim()
  if (account.kind !== 'Checking' || account.institution === null) {
    return product.slice(0, 120) || 'Conta do Open Finance'
  }
  const siblings = all.filter((a) => a.kind === 'Checking' && a.institution === account.institution)
  const base = account.institution.trim()
  const label =
    siblings.length > 1 && account.numberSuffix !== null
      ? `${base} · final ${account.numberSuffix}`
      : base
  return label.slice(0, 120)
}

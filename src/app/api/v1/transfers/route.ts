/**
 * `POST /api/v1/transfers` — "Redirecionar valor" (ADR-0017 §2, hotspot H12).
 *
 * Esta rota existe para uma coisa: fazer o débito e o crédito acontecerem
 * juntos. Antes dela o cliente disparava um `PATCH` por lado, e o comentário no
 * `block-detail-modal.tsx` admitia o buraco por escrito — "não é uma transação
 * atômica de backend, então se uma falhar as anteriores já aconteceram".
 * Redirecionar R$ 5.000 de uma conta para um investimento podia debitar a conta
 * e nunca creditar o investimento: os R$ 5.000 deixavam de existir, sem aviso.
 *
 * `balance` e `accumulatedValue` são campos mantidos pela pessoa
 * (files_design/03), não derivados de lançamentos — por isso mover dinheiro É
 * reescrever os dois, e não criar um lançamento. O que mudou não é a natureza
 * da escrita, é ela ser uma só.
 *
 * As regras ficam em `@/domain/transfer`; aqui só se lê o razão, delega, e
 * grava o que a regra devolveu — um handler autoriza, parseia, delega e
 * serializa (ADR-0013 letra S).
 */

import type { TransferPosition } from '@/domain/transfer'
import { asId, cents, isoDate } from '@/domain/core'
import type { BankAccountId, InvestmentId } from '@/domain/core'
import { withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { applyTransfer } from '@/api/transfers'
import { transferSchema } from '@/api/contracts/transfers'

function toPosition(
  raw:
    { kind: 'BankAccount'; bankAccountId: string } | { kind: 'Investment'; investmentId: string },
): TransferPosition {
  return raw.kind === 'BankAccount'
    ? { kind: 'BankAccount', bankAccountId: asId<BankAccountId>(raw.bankAccountId) }
    : { kind: 'Investment', investmentId: asId<InvestmentId>(raw.investmentId) }
}

export const POST = handler({
  operation: 'transfers.create',
  body: transferSchema,
  handle: async ({ session, body }) => {
    const transfer = {
      date: isoDate(body.date),
      sources: body.sources.map((source) => ({
        position: toPosition(source.position),
        amount: cents(source.amount),
      })),
      destination: toPosition(body.destination),
      amount: cents(body.amount),
    }

    // Tudo dentro da MESMA transação, leitura inclusive: ler os saldos fora
    // dela deixaria a janela em que outra escrita muda o saldo entre o plano e
    // a gravação, que é o defeito de novo, só mais estreito.
    return withTransaction(async (repos) => {
      const aplicadas = await applyTransfer(repos, session.userId, transfer)
      return ok({ applied: aplicadas, amount: transfer.amount })
    })
  },
})

/**
 * `POST /api/v1/leftover-directions` — "Direcionar agora" na Pendência de sobra
 * do Consumo Livre (P14, produto 2026-09-08).
 *
 * Grava um pedaço da sobra de um mês já direcionado. A Pendência em si não é
 * guardada: ela é `sobra(mês) − soma daqui`, derivada em
 * `GET /api/v1/pending-items` — o que dá o parcelamento de graça, igual à
 * pendência de venda de bem material.
 *
 * Só POST. Um direcionamento é fato consumado; corrigir é direcionar de novo.
 *
 * O destino `Discretionary` é o único que devolve o dinheiro à verba do mês
 * seguinte (`leftoverBroughtForward`). Os outros três apenas registram para
 * onde foi — mover o saldo da conta ou do investimento continua sendo o mesmo
 * `PATCH` que o "Redirecionar valor" já usa (`src/app/(app)/inicio/_lib/mutations.ts`),
 * porque saldo de conta é campo mantido pela pessoa, não derivado.
 */

import {
  allowanceForMonth,
  assertDirectionFits,
  hasLeftover,
  leftoverBroughtForward,
  leftoverOfMonth,
  pendingLeftover,
  totalSpent,
} from '@/domain/discretionary-spending'
import { asId, cents, month as toMonth, previousMonth, isoDate } from '@/domain/core'
import type { BankAccountId, InvestmentId, LiabilityId } from '@/domain/core'
import type { LeftoverDestination } from '@/domain/discretionary-spending'
import { getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { created, list, NotFoundError } from '@/api/http'
import { applyTransfer } from '@/api/transfers'
import { leftoverDirectionSchema } from '@/api/contracts/pending-items'

/**
 * A lista dos direcionamentos. A tela precisa dela para saber quanto da sobra
 * voltou para a verba deste mês — o único destino que sobe o teto.
 */
export const GET = handler({
  operation: 'leftover_directions.list',
  handle: async ({ session }) => {
    const { leftoverDirectionReader } = getRepositories()
    return list(await leftoverDirectionReader.list(session.userId))
  },
})

export const POST = handler({
  operation: 'leftover_directions.create',
  body: leftoverDirectionSchema,
  handle: async ({ session, body }) => {
    const {
      discretionarySpendingConfigReader,
      discretionaryExpenseReader,
      leftoverDirectionReader,
    } = getRepositories()

    const alvo = toMonth(body.month)
    const [config, gastos, direcionamentos] = await Promise.all([
      discretionarySpendingConfigReader.find(session.userId),
      discretionaryExpenseReader.listByMonth(session.userId, alvo),
      leftoverDirectionReader.list(session.userId),
    ])
    if (config === null) {
      throw new NotFoundError('O Consumo Livre ainda não foi configurado.')
    }

    // A verba daquele mês soma só o que a pessoa trouxe da sobra anterior — a
    // sobra não sobe o teto sozinha desde a P14.
    const verba = allowanceForMonth(
      config,
      leftoverBroughtForward(direcionamentos, previousMonth(alvo)),
    )
    // Verba = saldo da conta (2026-09-29): não há sobra a direcionar, o
    // dinheiro que sobrou continua na conta de origem.
    const sobra = hasLeftover(config) ? leftoverOfMonth(verba, totalSpent(gastos)) : cents(0)
    const restante = pendingLeftover(sobra, direcionamentos, alvo)

    const valor = cents(body.amount)
    assertDirectionFits(restante, valor)
    const destino = destinoDoCorpo(body.destination)

    // Abater dívida é amortização extraordinária — o saldo devedor é derivado
    // do cronograma e mexer nele é decisão de produto em aberto (ADR-0017,
    // "Explicitamente NÃO feito"). Recusa explícita, não no-op silencioso.
    if (destino.kind === 'Liability') {
      throw new Error('allocations.liability_not_supported')
    }

    // ADR-0017 §4, refinado pela medição: esta origem NÃO é "credita e não
    // debita ninguém". A sobra é dinheiro que está numa conta conhecida — a
    // `sourceAccountId` da própria configuração do widget —, então mandá-la
    // para uma conta ou um investimento é uma TRANSFERÊNCIA. Creditar sem
    // debitar inflaria o Patrimônio Líquido, porque `balance` e
    // `accumulatedValue` somam os dois no Ativo do Balanço.
    //
    // O destino `Discretionary` é a exceção e continua não mexendo em saldo: o
    // dinheiro fica onde está e só sobe a verba do mês seguinte.
    return withTransaction(async (repos) => {
      if (destino.kind !== 'Discretionary') {
        await applyTransfer(repos, session.userId, {
          date: isoDate(`${alvo}-01`),
          sources: [
            {
              position: { kind: 'BankAccount', bankAccountId: config.sourceAccountId },
              amount: valor,
            },
          ],
          destination:
            destino.kind === 'BankAccount'
              ? { kind: 'BankAccount', bankAccountId: destino.bankAccountId }
              : { kind: 'Investment', investmentId: destino.investmentId },
          amount: valor,
        })
      }

      const stored = await repos.leftoverDirectionWriter.create(session.userId, {
        month: alvo,
        amount: valor,
        // A borda marca os ids: o schema Zod entrega `string`, o domínio quer o
        // tipo marcado. É a mesma conversão que `asId` faz em toda rota.
        destination: destino,
      })
      return created(`/leftover-directions/${stored.id}`, stored)
    })
  },
})

function destinoDoCorpo(
  d:
    | { kind: 'Discretionary' }
    | { kind: 'BankAccount'; bankAccountId: string }
    | { kind: 'Investment'; investmentId: string }
    | { kind: 'Liability'; liabilityId: string },
): LeftoverDestination {
  switch (d.kind) {
    case 'Discretionary':
      return { kind: 'Discretionary' }
    case 'BankAccount':
      return { kind: 'BankAccount', bankAccountId: asId<BankAccountId>(d.bankAccountId) }
    case 'Investment':
      return { kind: 'Investment', investmentId: asId<InvestmentId>(d.investmentId) }
    case 'Liability':
      return { kind: 'Liability', liabilityId: asId<LiabilityId>(d.liabilityId) }
  }
}

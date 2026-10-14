/**
 * O retrato mensal do PL é gravado aqui, e em nenhum outro lugar — P21,
 * decidido em 2026-09-09.
 *
 * **Por que existe.** O Balanço Patrimonial não tem histórico e não pode ganhar
 * um por derivação: `BankAccount.balance` e `Investment.accumulatedValue` só
 * mudam quando a pessoa os edita — medido em 2026-09-09, pagar um Lançamento
 * não move saldo nenhum. Sem retrato, a Evolução Mensal desenhava o PL de meses
 * passados assumindo que só o Lucro Líquido o movia, o que a mesma medição
 * mostra ser falso: o Lucro Líquido move o DRE, o PL move quando a pessoa edita
 * um número, e os dois são independentes.
 *
 * **Por que no composition root, e não nas rotas.** Doze rotas mexem em
 * patrimônio (conta, investimento, bem material, passivo, parcela, reajuste).
 * Chamar o gravador em cada uma seria doze lugares para esquecer um, e uma rota
 * nova nasceria sem ele. Aqui os escritores são DECORADOS uma vez: qualquer
 * gravação de patrimônio, existente ou futura, tira o retrato sem que a rota
 * saiba disso — ADR-0013 §O, "recurso novo entra acrescentando".
 *
 * **O que custa.** Cada mutação de patrimônio recalcula os três Balanços, o que
 * relê contas, investimentos, bens, passivos e o cronograma inteiro de cada
 * passivo. É caro por chamada e barato no total: essas mutações são raras (a
 * pessoa ajusta um saldo de vez em quando), ao contrário de pagar Lançamento,
 * que não passa por aqui.
 */

import { VIEWS, add, monthOf, type IsoDate, type View } from '@/domain/core'
import { computeBalanceSheet } from '@/domain/reports'
import type { UserId } from './contracts/common'
import type { NetWorthSnapshotWriter } from './contracts/net-worth-snapshots'
import type { BankAccountReader } from './contracts/bank-accounts'
import type { InvestmentReader } from './contracts/investments'
import type { TangibleAssetReader } from './contracts/tangible-assets'
import type { InstallmentReader, LiabilityReader } from './contracts/liabilities'

export interface NetWorthSources {
  readonly bankAccountReader: BankAccountReader
  readonly investmentReader: InvestmentReader
  readonly tangibleAssetReader: TangibleAssetReader
  readonly liabilityReader: LiabilityReader
  readonly installmentReader: InstallmentReader
  readonly netWorthSnapshotWriter: NetWorthSnapshotWriter
}

/** Tira o retrato das três visões para o mês de `today`, sobrescrevendo o do mesmo mês. */
export async function recordNetWorthSnapshot(
  sources: NetWorthSources,
  userId: UserId,
  today: IsoDate,
): Promise<void> {
  const [bankAccounts, investments, tangibleAssets, liabilities] = await Promise.all([
    sources.bankAccountReader.list(userId),
    sources.investmentReader.list(userId),
    sources.tangibleAssetReader.list(userId),
    sources.liabilityReader.list(userId),
  ])

  const installmentsByLiability = new Map(
    await Promise.all(
      liabilities.map(
        async (liability) =>
          [
            liability.id,
            await sources.installmentReader.listByLiability(userId, liability.id),
          ] as const,
      ),
    ),
  )

  const month = monthOf(today)
  for (const view of VIEWS) {
    const sheet = computeBalanceSheet({
      asOf: today,
      view: view as View,
      bankAccounts,
      investments,
      tangibleAssets,
      liabilities,
      installmentsByLiability,
    })
    await sources.netWorthSnapshotWriter.record(userId, {
      month,
      view: view as View,
      netWorth: sheet.netWorth,
      // P22: o mesmo retrato carrega o total investido da visão. Somado aqui e
      // não lido do Balanço porque lá ele já vem misturado no Ativo.
      investmentsTotal: add(
        ...investments
          // Mesma regra de `isInView` (balance-sheet.ts), que é local lá.
          .filter((investment) => view === 'Consolidated' || view === investment.entity)
          .map((investment) => investment.accumulatedValue),
      ),
      recordedOn: today,
    })
  }
}

/* -------------------------------------------------------------------------
 * O decorador
 * ---------------------------------------------------------------------- */

/**
 * Envolve um escritor de patrimônio para que toda gravação tire o retrato do
 * mês depois de acontecer — depois, e não antes, porque o retrato tem que ver o
 * estado novo.
 *
 * Genérico sobre o objeto inteiro: qualquer método que devolva Promise passa a
 * gravar o retrato ao terminar. Um método NOVO na porta entra coberto, o que é
 * o ponto de decorar em vez de chamar em cada rota.
 *
 * O `userId` sai do PRIMEIRO argumento, que toda porta deste repositório recebe
 * (`create(userId, …)`, `replace(userId, …)`, `remove(userId, …)` — ver
 * `contracts/common.ts`). É o que permite decorar no composition root, que é
 * único por processo e não conhece a sessão da requisição.
 */
function recordingProxy<T extends object>(
  writer: T,
  onWrite: (userId: UserId) => Promise<void>,
): T {
  return new Proxy(writer, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown
      if (typeof value !== 'function') return value
      return async (...args: unknown[]) => {
        const result = await (value as (...a: unknown[]) => unknown).apply(target, args)
        await onWrite(args[0] as UserId)
        return result
      }
    },
  })
}

export interface NetWorthWriters {
  readonly bankAccountWriter: object
  readonly investmentWriter: object
  readonly tangibleAssetWriter: object
  readonly liabilityWriter: object
  readonly installmentWriter: object
  readonly rateAdjustmentWriter: object
}

/**
 * Aplica o retrato aos seis escritores que podem mover o PL. Os outros — Entry,
 * Recorrência, Categoria, Consumo Livre — ficam de fora porque medidamente não
 * movem: pagar um Lançamento não altera saldo de conta nem valor de
 * investimento.
 */
export function withNetWorthRecording<R extends NetWorthSources & NetWorthWriters>(
  repositories: R,
  today: () => IsoDate,
): R {
  const onWrite = (userId: UserId) => recordNetWorthSnapshot(repositories, userId, today())
  return {
    ...repositories,
    bankAccountWriter: recordingProxy(repositories.bankAccountWriter, onWrite),
    investmentWriter: recordingProxy(repositories.investmentWriter, onWrite),
    tangibleAssetWriter: recordingProxy(repositories.tangibleAssetWriter, onWrite),
    liabilityWriter: recordingProxy(repositories.liabilityWriter, onWrite),
    installmentWriter: recordingProxy(repositories.installmentWriter, onWrite),
    rateAdjustmentWriter: recordingProxy(repositories.rateAdjustmentWriter, onWrite),
  }
}

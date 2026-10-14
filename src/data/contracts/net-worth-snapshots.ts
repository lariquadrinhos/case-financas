/**
 * O retrato mensal do Patrimônio Líquido — P21, decidido em 2026-09-09.
 *
 * Não é um repositório de agregado como os outros: não há `create`/`remove`,
 * porque a pessoa nunca cria nem apaga um retrato. Ele é gravado pelo sistema
 * quando o patrimônio muda, e lido em bloco pela Evolução Mensal. Daí o par ser
 * `record`/`listByView` e não `Writer`/`Reader` — a suíte de contrato genérica
 * não se aplica, e a própria do adaptador cobre as invariantes (SOLID/L,
 * ADR-0013).
 */

import type { Cents, IsoDate, Month, View } from '@/domain/core'
import type { UserId } from './common'

export interface NetWorthSnapshot {
  readonly month: Month
  readonly view: View
  readonly netWorth: Cents
  /**
   * O total investido no mesmo instante — P22, 2026-09-11.
   *
   * Mora aqui e não numa tabela própria porque é o MESMO retrato: quem move
   * patrimônio move os dois, e a decoração do composition root já passa por
   * aqui em toda mutação. Uma tabela paralela seria um segundo lugar para
   * esquecer de gravar.
   */
  readonly investmentsTotal: Cents
  readonly recordedOn: IsoDate
}

export interface NetWorthSnapshotReader {
  /** Do mais antigo para o mais recente. */
  listByView(userId: UserId, view: View): Promise<readonly NetWorthSnapshot[]>
}

export interface NetWorthSnapshotWriter {
  /**
   * Grava o retrato de `(month, view)`, SOBRESCREVENDO o que já houver do mesmo
   * mês: o que interessa é o último do mês, que é o fechamento dele.
   */
  record(userId: UserId, snapshot: NetWorthSnapshot): Promise<void>
}

/**
 * Consumo Livre — a monthly allowance the person spends without itemising
 * (files_design/01 §4a, files_design/03 "Consumo Livre — widget").
 *
 * It is exclusively an expense line of the DRE, inside Despesas Pessoais, never
 * an ativo circulante and never computed as "esperado − real" (PRD §1, v6 fix A).
 * The screen keeps the label "Consumo Livre".
 */

import type {
  BankAccountId,
  Cents,
  Entity,
  EntryId,
  InvestmentId,
  IsoDate,
  LeftoverDirectionId,
  LiabilityId,
  Month,
} from '@/domain/core'

/** Estado A of the widget: the two fields the person configures once. */
export interface DiscretionarySpendingConfig {
  /** "Valor mensal" — the allowance, refilled on the 1st (files_design/01 §4a). */
  readonly monthlyAmount: Cents
  readonly sourceAccountId: BankAccountId
  /** Inherited by every expense of the widget; the form's default is PF (files_design/03). */
  readonly entity: Entity
  /**
   * What the month's limit is (decisão do dono, 2026-09-29): `Fixed` — the
   * "Valor mensal" above; `SourceBalance` — what is in the conta de origem
   * ("o dinheiro que está nessa conta é o meu consumo livre"). Absent means
   * `Fixed`, which is what every configuration before this field was.
   */
  readonly allowanceKind?: DiscretionaryAllowanceKind
}

export const DISCRETIONARY_ALLOWANCE_KINDS = ['Fixed', 'SourceBalance'] as const
export type DiscretionaryAllowanceKind = (typeof DISCRETIONARY_ALLOWANCE_KINDS)[number]

/**
 * One "Gastei um valor". The popover asks for the amount only: the date is
 * today, the account and the entity come from the config, and the category is
 * always the fixed "Consumo Livre" (files_design/03).
 *
 * Never negative (PRD §1).
 *
 * `id` is an `EntryId` because the widget creates a real Lançamento — this type
 * is the widget's view of it, carrying the one field the Lançamento de despesa
 * does not have.
 *
 * The Rótulo is a field OF the Lançamento, not a record parallel to it, and the
 * Figma says so: the Wireframe note `164:5` ("Nota — Por que \"Rótulo\" só em
 * Consumo Livre e IR"), text `164:7`, reads "Rótulo existe só nas abas que não
 * têm campo de Categoria (Consumo Livre e IR), porque sem Categoria, não tem
 * outro jeito de diferenciar lançamentos parecidos no Histórico. Despesa,
 * Receita e Pró-labore/Distribuição já têm Categoria, então Rótulo seria
 * redundante ali." Rótulo takes the place Categoria would occupy — and Categoria
 * is a field of the Lançamento — which is exactly how the aba IR draws it, as a
 * form field between Data and RECORRÊNCIA (frame `262:226`, group `68:3`, label
 * `68:4` "Rótulo (opcional)", input `68:5`).
 *
 * It is null on creation because the "Gastei um valor" popover asks for nothing
 * else — frame `345:1002`, legend `345:1258`: "Sem categoria, sem conta, sem
 * data pra escolher, só o valor." — and it is filled afterwards from the
 * history row's "Editar" (frame `345:752`, buttons `199:2`/`199:4`/`199:6`;
 * files_design/03: "Campos editáveis: Valor, e opcionalmente Rótulo").
 */
export interface DiscretionaryExpense {
  readonly id: EntryId
  readonly date: IsoDate
  readonly amount: Cents
  readonly label: string | null
}

/**
 * The widget's history also shows the previous month's leftover as an explicit
 * positive line, "+ Sobra de Junho, adicionada ao saldo" — required by PRD v7
 * (§Consumo Livre, UC32 and the critério de liberação), by files_design/01 §4a
 * and by the frame 345:752, node `192:22` (texts `192:23` / `192:24`), and
 * rendered by src/app/(app)/inicio/_components/modals/discretionary-detail-modal.tsx.
 *
 * It is NOT a `DiscretionaryExpense`: this type is always money going out.
 * Se a sobra é registro guardado ou valor derivado foi respondido em
 * 2026-09-08 (P14) — ver a seção "Sobra do mês" logo abaixo. Continua derivada
 * do mês anterior por `leftoverOfMonth` (./rules.ts).
 */

/* -------------------------------------------------------------------------
 * Sobra do mês — P14 (produto, 2026-09-08)
 * ---------------------------------------------------------------------- */

/**
 * Para onde a pessoa mandou parte da sobra de um mês.
 *
 * `Discretionary` é o destino novo: a sobra volta como verba DESTE mês, e é o
 * único que `allowanceForMonth` soma. Os outros três já eram os destinos do
 * "Redirecionar" (`Buscar conta, investimento, dívida ou Consumo Livre…`).
 */
export type LeftoverDestination =
  | { readonly kind: 'Discretionary' }
  | { readonly kind: 'BankAccount'; readonly bankAccountId: BankAccountId }
  | { readonly kind: 'Investment'; readonly investmentId: InvestmentId }
  | { readonly kind: 'Liability'; readonly liabilityId: LiabilityId }

/**
 * Um pedaço da sobra de um mês, já direcionado.
 *
 * P14 (produto, 2026-09-08): a sobra do mês anterior não entra sozinha em lugar
 * nenhum — ela vira **Pendência** na Home ("valor sem destino", que é o que a
 * legenda do card sempre prometeu), e a pessoa decide. O teto do mês continua
 * sendo a verba configurada até ela mandar a sobra para cá, e é isso que faz os
 * números do frame `345:752` fecharem: R$ 500 de verba − R$ 150 de gastos =
 * "R$ 350 de R$ 500", com a sobra de R$ 150 ainda sem destino.
 *
 * O que se GUARDA é o direcionamento, não a pendência. A pendência continua
 * derivada — `sobra(mês) − soma dos direcionamentos daquele mês` — o que
 * preserva ADR-0001 §1 (só fato é guardado), dispensa materializar nada no
 * virar do mês e dá o parcelamento de graça: direcionar R$ 100 de R$ 150 deixa
 * a pendência com R$ 50, igual à de venda de bem material.
 */
export interface LeftoverDirection {
  readonly id: LeftoverDirectionId
  /** O mês de ORIGEM da sobra, não o mês em que foi direcionada. */
  readonly month: Month
  readonly amount: Cents
  readonly destination: LeftoverDestination
}

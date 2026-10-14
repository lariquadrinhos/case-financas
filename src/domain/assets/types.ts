/**
 * Patrimônio — contas bancárias, bens materiais, investimentos e passivos.
 *
 * Two rules shape every type here:
 * - **Realisation on sale only** (PRD §5): investments are not marked to market
 *   and tangible assets are not depreciated monthly. Gain or loss shows up in
 *   Resultado Não Operacional at the moment of the sale, never before.
 * - **Liabilities are 100% manual** (Event Storming H9): paying an expense does
 *   not amortise a debt. The debt is its own plane, kept by the person.
 */

import type {
  AllocationId,
  BankAccountId,
  Cents,
  Classification,
  Entity,
  EntryStatus,
  InstallmentId,
  InvestmentId,
  IsoDate,
  LiabilityId,
  PendingAllocationId,
  TangibleAssetId,
} from '@/domain/core'

/**
 * A swatch of the account colour palette. The domain stores the slug, never a
 * hex: colour is presentation and the hex lives in `src/styles/tokens.css`
 * (fill literal, sem token semântico — cor de marca de terceiro não é token do
 * sistema, files_design/02).
 *
 * A lista é FECHADA e tem exatamente estas seis entradas, nesta ordem: Figma,
 * página **Tokens**, nó `1091:2` "Cores de banco (referência)" — uma linha por
 * cor (`1091:5055` Nubank · `1091:5061` Itaú · `1091:5067` Banco do Brasil ·
 * `1091:5073` Bradesco · `1091:5079` Caixa · `1091:5085` "Cor extra"), cada uma
 * com bolinha, nome, hex, rgb e fonte. A mesma tabela está transcrita em
 * files_design/07 §"Cores de banco (referência, fora do sistema de tokens)".
 *
 * O comentário que estava aqui dizia que "the closed list of token names is not
 * defined anywhere yet" e listava C6 Bank como sexta cor: as duas afirmações são
 * falsas — `1091:2` existe (medido no arquivo, node por node) e o C6 saiu da
 * paleta (files_design/02, "C6 Bank saiu da paleta de cores de conta, virou
 * 'Cor extra' genérica"). O custo da lista aberta era medível: `POST
 * /api/v1/bank-accounts` com `colour: "conta-roxa"` respondia **201**, e a tela
 * pintava a bolinha de cinza pelo fallback de `bankAccountSwatch` — erro de
 * entrada virava dado válido e silencioso.
 *
 * O slug da sexta cor continua `outra` (não `cor-extra`) porque é dado de fio já
 * gravado; o Figma nomeia o rótulo visível (`1091:5087` "Cor extra"), não o slug.
 */
/**
 * A paleta da conta bancária, em duas metades — decidido em 2026-09-11.
 *
 * As cinco primeiras são cores de MARCA dos bancos, e são as que a faixa mostra
 * como sugestão. As seis seguintes são as cores extras, que vivem dentro do
 * color pick: cinco matizes novas, escolhidas para não colidirem com as de
 * banco (roxo, laranja, dois azuis, vermelho), mais o cinza que já existia.
 *
 * O cinza continua com o slug `outra` de propósito. Ele é dado já gravado, e
 * uma conta existente usa esse valor — renomear exigiria migração para mudar
 * nada na tela.
 */
export const BANK_ACCOUNT_COLOURS = [
  'nubank',
  'itau',
  'banco-do-brasil',
  'bradesco',
  'caixa',
  'green',
  'teal',
  'gold',
  'pink',
  'brown',
  'outra',
] as const

export type BankAccountColour = (typeof BANK_ACCOUNT_COLOURS)[number]

/**
 * "Legenda/cor" of the PRD, split into two fields by design (files_design/02):
 * `label` is the account name the person types ("Nubank", "Itaú PJ") and
 * `colour` is the swatch.
 *
 * `balance` is kept by the person, not derived from entries (PRD §1: "Cada
 * conta tem seu próprio saldo, mantido pela pessoa").
 */
export interface BankAccount {
  readonly id: BankAccountId
  readonly label: string
  readonly colour: BankAccountColour
  /** A toggle with a pre-selected value never ends up empty (files_design/01 §5.6). */
  readonly entity: Entity
  readonly balance: Cents
}

/**
 * "Bem Material" — never `Asset`: in the Balanço, "Ativo" also covers accounts
 * and investments, and the design renamed the concept precisely to disambiguate
 * (files_design/04).
 */
export interface TangibleAsset {
  readonly id: TangibleAssetId
  readonly name: string
  readonly entity: Entity
  /** "Valor inicial" — what the asset is carried at, with no depreciation (PRD §5). */
  readonly recordedValue: Cents
  /** Set on sale; a sold asset leaves the Bens Materiais list (files_design/01 §11). */
  readonly soldOn: IsoDate | null
}

/**
 * Valor investido acumulado: opening balance plus contributions. No monthly
 * revaluation — the appreciation is not shown anywhere (PRD §1).
 */
export interface Investment {
  readonly id: InvestmentId
  readonly name: string
  readonly entity: Entity
  readonly accumulatedValue: Cents
}

/** files_design/03 "Passivos (formulário completo)" — all ten fields. */
export interface Liability {
  readonly id: LiabilityId
  readonly name: string
  readonly creditor: string
  readonly entity: Entity
  /** Suggested from a keyword in the name, then editable (files_design/03). */
  readonly classification: Classification
  readonly originalAmount: Cents
  readonly installmentAmount: Cents
  readonly installmentCount: number
  /** Pre-populates the history when an ongoing debt is registered (files_design/03). */
  readonly installmentsAlreadyPaid: number
  /**
   * Monthly rate as a decimal fraction: 0.0085 is the 0,85% a.m. the screen
   * shows. Same unit `multiply` in core/money expects.
   */
  readonly monthlyInterestRate: number
  readonly startDate: IsoDate
}

/**
 * A row of the amortisation schedule, generated from the Liability form and
 * recomputed on every rate adjustment (files_design/03 "objeto Parcela").
 *
 * `status` reuses `EntryStatus` — the same two states, shown in the feminine on
 * this screen ("Prevista" / "Paga"), see `LABEL_INSTALLMENT_STATUS`.
 */
export interface Installment {
  readonly id: InstallmentId
  readonly liabilityId: LiabilityId
  /** Sequential, 1..installmentCount. */
  readonly number: number
  readonly plannedDate: IsoDate
  readonly plannedAmount: Cents
  readonly status: EntryStatus
  /** Only when Paga, and it may differ from the planned amount (files_design/03). */
  readonly paidAmount: Cents | null
  /**
   * A data em que a pessoa DIZ que pagou, não a prevista — e é ela que decide o
   * mês contábil da parcela no DRE (PRD §5, regime de caixa; CLAUDE.md §3).
   * Uma parcela prevista para 10/08 e paga em 02/09 é despesa de setembro.
   *
   * O formulário já pedia essa data e o endpoint já a recebia (`paymentDate` em
   * `installmentPaymentSchema`); ela ia só para o TraceEvent e era descartada da
   * parcela. Passou a ser persistida ao fechar a P6, que é quem trouxe a parcela
   * para dentro da cascata e portanto criou a pergunta "em que mês?".
   */
  readonly paidDate: IsoDate | null
  /**
   * "Descartar" pulou ESTA parcela na Revisão de Recorrentes deste mês. Mesma
   * semântica de `Occurrence.discarded` (src/domain/recurrence/types.ts), e
   * pela mesma fonte: Figma `34:2` nó 34:36, "A série continua normalmente a
   * partir do mês seguinte" — o cronograma NÃO se desloca (a parcela #13
   * continua sendo a #13, com a mesma data) e o saldo devedor não muda, porque
   * `outstandingBalance` desconta tudo que ainda está Prevista.
   */
  readonly discarded: boolean
}

export const LABEL_INSTALLMENT_STATUS: Record<EntryStatus, string> = {
  Planned: 'Prevista',
  Paid: 'Paga',
}

/**
 * "Registrar Reajuste de Juros". Recomputes the planned amount of every
 * installment still Prevista from `effectiveFrom` onwards; installments already
 * paid are never rewritten (files_design/03).
 */
export interface RateAdjustment {
  readonly liabilityId: LiabilityId
  /** Decimal fraction, same unit as `Liability.monthlyInterestRate`. */
  readonly newRate: number
  readonly effectiveFrom: IsoDate
}

/**
 * "Direcionamento" — where the money from a sale goes. `Revenue` has no target:
 * it opens the Receita form and produces its own Lançamento
 * (files_design/03 "Objeto Direcionamento").
 */
export const ALLOCATION_KINDS = ['Investment', 'Liability', 'Revenue'] as const
export type AllocationKind = (typeof ALLOCATION_KINDS)[number]

export const LABEL_ALLOCATION_KIND: Record<AllocationKind, string> = {
  Investment: 'Investimento',
  Liability: 'Passivo',
  Revenue: 'Receita',
}

interface AllocationBase {
  readonly id: AllocationId
  /** Never more than what is still undirected at that moment (files_design/03). */
  readonly amount: Cents
}

export interface InvestmentAllocation extends AllocationBase {
  readonly kind: 'Investment'
  readonly target: InvestmentId
}

/** Ex.: amortização extraordinária of a debt (files_design/01 §11). */
export interface LiabilityAllocation extends AllocationBase {
  readonly kind: 'Liability'
  readonly target: LiabilityId
}

export interface RevenueAllocation extends AllocationBase {
  readonly kind: 'Revenue'
  readonly target: null
}

export type Allocation = InvestmentAllocation | LiabilityAllocation | RevenueAllocation

/**
 * "Vender Bem Material". Ganho/perda (`amount` minus the asset's
 * `recordedValue`) is computed, not stored: it is posted to Resultado Não
 * Operacional in the month of the sale (files_design/01 §11).
 *
 * Whatever is left after the allocations becomes a `PendingAllocation`.
 */
export interface AssetSale {
  readonly tangibleAssetId: TangibleAssetId
  readonly amount: Cents
  readonly date: IsoDate
  readonly allocations: readonly Allocation[]
}

/**
 * Where a pending amount came from. A one-variant union on purpose: the sale of
 * a bem material is the only origin the sources describe today
 * (files_design/03 "Pendente de Direcionamento"), and adding a second one must
 * not break the call sites that read it.
 */
export interface TangibleAssetSaleOrigin {
  readonly kind: 'TangibleAssetSale'
  readonly tangibleAssetId: TangibleAssetId
}

export type AllocationOrigin = TangibleAssetSaleOrigin

export const PENDING_ALLOCATION_STATUSES = ['Pending', 'Allocated'] as const
export type PendingAllocationStatus = (typeof PENDING_ALLOCATION_STATUSES)[number]

export const LABEL_PENDING_ALLOCATION_STATUS: Record<PendingAllocationStatus, string> = {
  Pending: 'Pendente',
  Allocated: 'Direcionado',
}

/** Shown as a banner on the Home while `status` is `Pending` (files_design/03). */
export interface PendingAllocation {
  readonly id: PendingAllocationId
  readonly origin: AllocationOrigin
  readonly amount: Cents
  /** When the amount became pending. */
  readonly originDate: IsoDate
  readonly status: PendingAllocationStatus
}

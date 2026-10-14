/**
 * Pendência unificada — Event Storming hotspot H13 ("um read model só, ordenado
 * por data, através dos 4 tipos"), bounded context 7 ("Pendências e
 * Rastreabilidade").
 *
 * PRD §5: "Pendência: conceito consultável, com tipo, valor, motivo, data de
 * criação, referência à origem e status. É criada e encerrada pelo sistema a
 * partir de quatro origens." This context does not write on its own — it is
 * "populado por política" (Event Storming, bounded contexts) — except for the
 * one origin that has nowhere else to live: a payment discrepancy (tipo 4,
 * below), which this module owns because no other context does.
 *
 * The other three origins already have their own type, owned by their own
 * context, exactly as the Event Storming "estado de implementação, honesto"
 * table describes:
 *   - tipo 1 → `PendingAllocation` (`@/domain/assets`)
 *   - tipo 2 → derived from `Occurrence.plannedAmount === null` (`@/domain/recurrence`)
 *   - tipo 3 → `UnallocatedProfitPendingItem` (`@/domain/profit-allocation`)
 *   - tipo 4 → `PaymentDiscrepancyPendingItem`, defined here
 *
 * This is the one domain module allowed to know about `assets`, `recurrence`
 * and `profit-allocation` all at once — src/domain/README.md's dependency rule
 * predates this context; the Event Storming diagram already draws context 7
 * reading from contexts 2-5, and this module is that read.
 */

import type {
  Cents,
  EntryId,
  IsoDate,
  Month,
  PaymentDiscrepancyId,
  BankAccountId,
  Entity,
} from '@/domain/core'
import type { PendingAllocation } from '@/domain/assets'
import type { Occurrence } from '@/domain/recurrence'
import type { UnallocatedProfitPendingItem } from '@/domain/profit-allocation'

/* -------------------------------------------------------------------------
 * Tipo 4 — Divergência de pagamento a menor
 *
 * files_design/03 "Marcar Pago": "Valor pago < previsto: a diferença fica como
 * pendente — aparece como um item próprio no card de Pendências... com botão
 * Pagar." Event Storming, Fluxo I: "Tipo 4 → nenhum tipo próprio; hoje só se lê
 * indiretamente do resultado Underpaid de src/domain/entries/rules.ts
 * (becomesPending: true), que não carrega id nem status."
 *
 * A shortfall needs a persisted identity because it must be findable and
 * resolvable in a LATER request than the one that created it — unlike tipos 2
 * e 3, which are always recomputed fresh from a still-existing Occurrence or
 * ProfitAllocation, there is nothing else in the system that remembers "this
 * entry was underpaid by this much" once `markAsPaid` overwrites the entry's
 * amount with what was actually paid.
 * ---------------------------------------------------------------------- */

/**
 * One-variant union on purpose, same reasoning as `AllocationOrigin`
 * (`@/domain/assets`): both `POST /entries/{id}/payment` and
 * `POST /occurrences/{id}/payment` end with a stored, Paid `Entry` — the
 * occurrence route creates one before marking itself paid — so the entry is
 * always the thing a shortfall is paid against, whichever route produced it.
 */
export interface EntryPaymentOrigin {
  readonly kind: 'Entry'
  readonly entryId: EntryId
}

export type PaymentDiscrepancyOrigin = EntryPaymentOrigin

export const PAYMENT_DISCREPANCY_STATUSES = ['Pending', 'Resolved'] as const
export type PaymentDiscrepancyStatus = (typeof PAYMENT_DISCREPANCY_STATUSES)[number]

export const LABEL_PAYMENT_DISCREPANCY_STATUS: Record<PaymentDiscrepancyStatus, string> = {
  Pending: 'Pendente',
  Resolved: 'Paga',
}

/** Shown as a Pendência card on the Home while `status` is `Pending`. */
export interface PaymentDiscrepancyPendingItem {
  readonly id: PaymentDiscrepancyId
  readonly origin: PaymentDiscrepancyOrigin
  /** "a diferença" (files_design/03) — always the shortfall, never the full paid amount. */
  readonly shortfall: Cents
  /** When the underpayment happened — the payment date, not today. */
  readonly originDate: IsoDate
  readonly status: PaymentDiscrepancyStatus
}

export type NewPaymentDiscrepancy = Omit<PaymentDiscrepancyPendingItem, 'id'>

/* -------------------------------------------------------------------------
 * O read model unificado
 * ---------------------------------------------------------------------- */

export const PENDING_ITEM_KINDS = [
  'AssetSaleAllocation',
  'UndefinedOccurrence',
  'UnallocatedProfit',
  'PaymentDiscrepancy',
  /**
   * P14 (produto, 2026-09-08) — a sobra do Consumo Livre do mês anterior. A
   * legenda do card sempre prometeu "valor sem destino", e esta é a segunda
   * origem desse tipo de valor, ao lado da venda de bem material.
   */
  'DiscretionaryLeftover',
  /**
   * PRD v7.46 (2026-09-29, "deixa que eu categorizo, sem de-para"): o que veio
   * do banco chega em "A categorizar" e fica pendente até a pessoa escolher a
   * categoria. UMA pendência por mês, com a contagem — uma por lançamento
   * inundaria o card com dezenas de cartões iguais.
   */
  'Uncategorized',
  /**
   * 2026-09-29 — dinheiro entre a PJ e a PF que o banco não sabe dizer o que
   * foi (pró-labore, distribuição, aporte, só transferência). Uma por
   * transferência: são poucas, e cada uma pede uma decisão própria.
   */
  'UnclassifiedTransfer',
] as const
export type PendingItemKind = (typeof PENDING_ITEM_KINDS)[number]

/**
 * "com a ação correspondente (Direcionar agora, Revisar agora, Alocar agora,
 * Pagar)" (PRD §1), in the same order the PRD lists the four tipos.
 */
export const LABEL_PENDING_ITEM_ACTION: Record<PendingItemKind, string> = {
  AssetSaleAllocation: 'Direcionar agora',
  UndefinedOccurrence: 'Revisar agora',
  UnallocatedProfit: 'Alocar agora',
  PaymentDiscrepancy: 'Pagar',
  // Mesma ação da venda de bem material: é o mesmo verbo para o mesmo problema,
  // e o vocabulário fechado (files_design/04) não ganha palavra nova à toa.
  DiscretionaryLeftover: 'Direcionar agora',
  Uncategorized: 'Categorizar agora',
  UnclassifiedTransfer: 'Classificar agora',
}

/**
 * Every variant carries `date` (for the oldest-first ordering, files_design/08
 * §9.1) and `amount`. `amount` is `null` only for `UndefinedOccurrence`: an "a
 * definir" occurrence has, by definition, no value yet — there is nothing to
 * format (files_design/01 §4, "recorrentes pendentes (valores 'a definir' não
 * preenchidos)" lists no amount).
 */
export interface DiscretionaryLeftoverPendingItem {
  /** O mês que sobrou — é ele que a tela nomeia ("Sobra do Consumo Livre de Junho"). */
  readonly month: Month
  /** Quanto ainda está sem destino: a sobra menos o que já foi direcionado. */
  readonly remaining: Cents
}

export interface UncategorizedPendingItem {
  readonly month: Month
  /** Quantos lançamentos do mês ainda estão em "A categorizar". */
  readonly count: number
}

export interface UnclassifiedTransferPendingItem {
  /** The provider's id of the money-out side — what the classification route takes. */
  readonly transactionId: string
  readonly from: Entity
  readonly to: Entity
  readonly fromBankAccountId: BankAccountId
  readonly toBankAccountId: BankAccountId
  /** The bank's text, so the person knows which PIX it was. */
  readonly description: string
}

export type PendingItem =
  | {
      readonly kind: 'UnclassifiedTransfer'
      readonly date: IsoDate
      readonly amount: Cents
      readonly item: UnclassifiedTransferPendingItem
    }
  | {
      readonly kind: 'Uncategorized'
      readonly date: IsoDate
      /** Não é valor a formatar: a pendência é de classificação, não de dinheiro. */
      readonly amount: null
      readonly item: UncategorizedPendingItem
    }
  | {
      readonly kind: 'DiscretionaryLeftover'
      readonly date: IsoDate
      readonly amount: Cents
      readonly item: DiscretionaryLeftoverPendingItem
    }
  | {
      readonly kind: 'AssetSaleAllocation'
      readonly date: IsoDate
      readonly amount: Cents
      readonly item: PendingAllocation
    }
  | {
      readonly kind: 'UndefinedOccurrence'
      readonly date: IsoDate
      readonly amount: null
      readonly item: Occurrence
    }
  | {
      readonly kind: 'UnallocatedProfit'
      readonly date: IsoDate
      readonly amount: Cents
      readonly item: UnallocatedProfitPendingItem
    }
  | {
      readonly kind: 'PaymentDiscrepancy'
      readonly date: IsoDate
      readonly amount: Cents
      readonly item: PaymentDiscrepancyPendingItem
    }

/**
 * Transferência entre entidades — what money between the PJ and the PF was
 * (decisão do dono, 2026-09-29: "vira Pendência, eu escolho").
 *
 * The bank cannot tell a pró-labore from a distribuição de lucro from a mere
 * transfer: the same PIX is all three. Same-entity moves (PF→PF, PJ→PJ) stay
 * automatic Transferências — the entity's money did not move. Cross-entity
 * ones become a Pendência, and the person's choice decides whether a
 * Lançamento is born:
 *
 *   PJ→PF  Pró-labore           → ProLabore entry (PJ expense, PF revenue, eliminated in Consolidado)
 *          Distribuição de lucro → ProfitDistribution entry (block 10 in the PJ, PF revenue)
 *          Só transferência      → nothing (e.g. a reimbursement)
 *   PF→PJ  Aporte na PJ          → nothing: capital, not revenue of the PJ nor expense of the PF
 *          Só transferência      → nothing
 */

import type { BankAccountId, Cents, Entity, IsoDate } from '@/domain/core'
import type { NewEntry } from '@/domain/entries'

export const TRANSFER_CLASSIFICATIONS = [
  'ProLabore',
  'ProfitDistribution',
  'CapitalContribution',
  'Transfer',
] as const
export type TransferClassification = (typeof TRANSFER_CLASSIFICATIONS)[number]

export function transferNeedsClassification(from: Entity, to: Entity): boolean {
  return from !== to
}

export function transferClassificationsFor(from: Entity, to: Entity): TransferClassification[] {
  if (from === 'PJ' && to === 'PF') return ['ProLabore', 'ProfitDistribution', 'Transfer']
  if (from === 'PF' && to === 'PJ') return ['CapitalContribution', 'Transfer']
  return ['Transfer']
}

export interface ClassifiedTransfer {
  readonly amount: Cents
  readonly date: IsoDate
  readonly fromBankAccountId: BankAccountId
  readonly toBankAccountId: BankAccountId
  readonly description: string
}

/**
 * The Lançamento a choice creates, or `null` when the choice keeps the money
 * out of the DRE. `entities`, when given, refuses a choice that does not exist
 * for that direction (a pró-labore from the PF to the PJ).
 */
export function entryForTransferClassification(
  classification: TransferClassification,
  transfer: ClassifiedTransfer,
  entities?: { readonly from: Entity; readonly to: Entity },
): NewEntry | null {
  if (
    entities !== undefined &&
    !transferClassificationsFor(entities.from, entities.to).includes(classification)
  ) {
    throw new Error('open_finance.transfer_classification_not_allowed')
  }
  if (classification !== 'ProLabore' && classification !== 'ProfitDistribution') return null
  return {
    kind: classification,
    amount: transfer.amount,
    date: transfer.date,
    status: 'Paid',
    recurrenceId: null,
    sourceAccountId: transfer.fromBankAccountId,
    destinationAccountId: transfer.toBankAccountId,
    description: transfer.description.trim().slice(0, 200) || null,
  }
}

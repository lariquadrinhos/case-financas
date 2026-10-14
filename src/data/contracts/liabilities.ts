/**
 * Passivos, parcelas e reajustes — three ports, not one.
 *
 * They are separate because their write patterns are different in kind: a
 * Passivo is created and edited by the person; an Installment is GENERATED as a
 * whole schedule and rewritten as a whole schedule on every rate adjustment
 * ("calculado por amortização", files_design/03 §6); a RateAdjustment is only
 * ever appended.
 *
 * Liabilities are 100% manual (Event Storming H9): paying an expense does not
 * amortise a debt, so nothing here is called from the entries flow.
 */

import type { Installment, Liability, RateAdjustment } from '@/domain/assets'
import type { Entity, InstallmentId, LiabilityId } from '@/domain/core'
import type { Reader, UserId, Writer } from './common'

export type NewLiability = Omit<Liability, 'id'>

export interface LiabilityReader extends Reader<Liability, LiabilityId> {
  listByEntity(userId: UserId, entity: Entity): Promise<readonly Liability[]>
}

export type LiabilityWriter = Writer<Liability, NewLiability, LiabilityId>

export interface InstallmentReader extends Reader<Installment, InstallmentId> {
  listByLiability(userId: UserId, liabilityId: LiabilityId): Promise<readonly Installment[]>
}

/**
 * `replaceSchedule` writes the whole table for one liability in a single
 * transaction. A per-row update would leave the schedule half-recomputed if it
 * failed in the middle — and half a schedule is a wrong Balanço, not a missing
 * one.
 */
export interface InstallmentWriter {
  replaceSchedule(
    userId: UserId,
    liabilityId: LiabilityId,
    installments: readonly Installment[],
  ): Promise<readonly Installment[]>
  replace(userId: UserId, installment: Installment): Promise<Installment>
}

export interface RateAdjustmentReader {
  listByLiability(userId: UserId, liabilityId: LiabilityId): Promise<readonly RateAdjustment[]>
}

/** Append only: a reajuste is a fact that happened on a date, never edited. */
export interface RateAdjustmentWriter {
  append(userId: UserId, adjustment: RateAdjustment): Promise<RateAdjustment>
}

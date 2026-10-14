/** Investimentos. `accumulatedValue` is opening balance plus contributions — no mark-to-market. */

import type { Investment } from '@/domain/assets'
import type { Entity, InvestmentId } from '@/domain/core'
import type { Reader, UserId, Writer } from './common'

export type NewInvestment = Omit<Investment, 'id'>

export interface InvestmentReader extends Reader<Investment, InvestmentId> {
  listByEntity(userId: UserId, entity: Entity): Promise<readonly Investment[]>
}

export type InvestmentWriter = Writer<Investment, NewInvestment, InvestmentId>

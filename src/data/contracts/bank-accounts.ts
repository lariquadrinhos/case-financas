/** Contas Bancárias. `balance` is kept by the person, not derived (PRD §1). */

import type { BankAccount } from '@/domain/assets'
import type { BankAccountId, Entity } from '@/domain/core'
import type { Reader, UserId, Writer } from './common'

export type NewBankAccount = Omit<BankAccount, 'id'>

export interface BankAccountReader extends Reader<BankAccount, BankAccountId> {
  /** Pró-labore filters the origin dropdown to PJ and the destination to PF. */
  listByEntity(userId: UserId, entity: Entity): Promise<readonly BankAccount[]>
}

export type BankAccountWriter = Writer<BankAccount, NewBankAccount, BankAccountId>

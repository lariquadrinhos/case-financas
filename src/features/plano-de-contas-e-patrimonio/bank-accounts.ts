'use client'

import { createResourceHooks } from './use-resource'
import type { BankAccount, NewBankAccount, BankAccountPatch } from './types'

export const bankAccounts = createResourceHooks<BankAccount, NewBankAccount, BankAccountPatch>(
  'bank-accounts',
)

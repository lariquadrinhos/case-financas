'use client'

import { createResourceHooks } from './use-resource'
import type { Liability, LiabilityPatch, NewLiability } from './types'

export const liabilities = createResourceHooks<Liability, NewLiability, LiabilityPatch>(
  'liabilities',
)

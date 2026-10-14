'use client'

import { createResourceHooks } from './use-resource'
import type { Investment, NewInvestment, InvestmentPatch } from './types'

export const investments = createResourceHooks<Investment, NewInvestment, InvestmentPatch>(
  'investments',
)

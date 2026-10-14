/**
 * Wire types for this group's screens, inferred straight from the Zod schemas
 * in `src/api/contracts/*` — CLAUDE.md §8.5: "leia o contrato do recurso antes
 * de escrever a tela que o consome". Inferring rather than hand-writing a
 * second copy is what keeps the two from drifting the first time a field is
 * added to a contract.
 */

import type { z } from 'zod'
import type {
  statementBlockSchema,
  categorySchema,
  newCategorySchema,
  categoryPatchSchema,
} from '@/api/contracts/chart-of-accounts'
import type {
  bankAccountSchema,
  newBankAccountSchema,
  bankAccountPatchSchema,
} from '@/api/contracts/bank-accounts'
import type {
  tangibleAssetSchema,
  newTangibleAssetSchema,
  tangibleAssetPatchSchema,
  allocationSchema,
  assetSaleSchema,
  assetSaleResultSchema,
} from '@/api/contracts/tangible-assets'
import type {
  investmentSchema,
  newInvestmentSchema,
  investmentPatchSchema,
} from '@/api/contracts/investments'
import type {
  liabilitySchema,
  newLiabilitySchema,
  liabilityPatchSchema,
  installmentSchema,
  rateAdjustmentSchema,
} from '@/api/contracts/liabilities'

export type StatementBlock = z.infer<typeof statementBlockSchema>
export type Category = z.infer<typeof categorySchema>
export type NewCategory = z.infer<typeof newCategorySchema>
export type CategoryPatch = z.infer<typeof categoryPatchSchema>

export type BankAccount = z.infer<typeof bankAccountSchema>
export type NewBankAccount = z.infer<typeof newBankAccountSchema>
export type BankAccountPatch = z.infer<typeof bankAccountPatchSchema>

export type TangibleAsset = z.infer<typeof tangibleAssetSchema>
export type NewTangibleAsset = z.infer<typeof newTangibleAssetSchema>
export type TangibleAssetPatch = z.infer<typeof tangibleAssetPatchSchema>
export type Allocation = z.infer<typeof allocationSchema>
export type AssetSale = z.infer<typeof assetSaleSchema>
export type AssetSaleResult = z.infer<typeof assetSaleResultSchema>

export type Investment = z.infer<typeof investmentSchema>
export type NewInvestment = z.infer<typeof newInvestmentSchema>
export type InvestmentPatch = z.infer<typeof investmentPatchSchema>

export type Liability = z.infer<typeof liabilitySchema>
export type NewLiability = z.infer<typeof newLiabilitySchema>
export type LiabilityPatch = z.infer<typeof liabilityPatchSchema>
export type Installment = z.infer<typeof installmentSchema>
export type RateAdjustment = z.infer<typeof rateAdjustmentSchema>

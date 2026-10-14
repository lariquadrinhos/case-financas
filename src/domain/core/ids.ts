/**
 * Opaque identifiers, one branded type per aggregate.
 *
 * These are `string`s with a phantom brand: the compiler refuses to pass a
 * `CategoryId` where a `BankAccountId` is expected — a mistake that genuinely
 * happens on a form screen with eight reference fields.
 */

export type EntryId = string & { readonly __brand: 'EntryId' }
export type RecurrenceId = string & { readonly __brand: 'RecurrenceId' }
export type OccurrenceId = string & { readonly __brand: 'OccurrenceId' }
export type CategoryId = string & { readonly __brand: 'CategoryId' }
export type BlockId = string & { readonly __brand: 'BlockId' }
export type BankAccountId = string & { readonly __brand: 'BankAccountId' }
export type TangibleAssetId = string & { readonly __brand: 'TangibleAssetId' }
export type InvestmentId = string & { readonly __brand: 'InvestmentId' }
export type LiabilityId = string & { readonly __brand: 'LiabilityId' }
export type InstallmentId = string & { readonly __brand: 'InstallmentId' }
export type TraceEventId = string & { readonly __brand: 'TraceEventId' }
export type AllocationId = string & { readonly __brand: 'AllocationId' }
export type PendingAllocationId = string & { readonly __brand: 'PendingAllocationId' }
export type PaymentDiscrepancyId = string & { readonly __brand: 'PaymentDiscrepancyId' }
/** Um pedaço da sobra de um mês, já direcionado — P14. */
export type LeftoverDirectionId = string & { readonly __brand: 'LeftoverDirectionId' }

/** Casts a plain string into a branded id. Use only at the edges (fixtures, DB rows, forms). */
export function asId<T extends string>(value: string): T {
  return value as T
}

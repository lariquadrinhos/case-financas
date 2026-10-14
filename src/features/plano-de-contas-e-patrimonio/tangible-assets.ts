'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'
import { createResourceHooks } from './use-resource'
import type {
  AssetSale,
  AssetSaleResult,
  NewTangibleAsset,
  TangibleAsset,
  TangibleAssetPatch,
} from './types'

export const tangibleAssets = createResourceHooks<
  TangibleAsset,
  NewTangibleAsset,
  TangibleAssetPatch
>('tangible-assets')

/**
 * "Vender Bem Material" (files_design/01 §11). A sale is not a PATCH: it
 * computes ganho/perda and may leave a Pendente de Direcionamento behind
 * (`POST /tangible-assets/{id}/sale`), so it gets its own mutation rather than
 * reusing `tangibleAssets.usePatch`.
 */
export function useSellTangibleAsset() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, sale }: { id: string; sale: AssetSale }) =>
      apiPost<AssetSaleResult>(`/tangible-assets/${id}/sale`, sale),
    onSuccess: () => client.invalidateQueries({ queryKey: tangibleAssets.key }),
  })
}

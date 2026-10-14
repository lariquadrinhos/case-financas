/**
 * Mapping the wire shape of "Objeto Direcionamento" (files_design/03) into the
 * domain's `Allocation` union — shared by every route that accepts one:
 * `POST /tangible-assets/{id}/sale` and `POST /pending-allocations/{id}/allocations`
 * today, and "Redirecionar valor" wherever it lands next (PRD §1 — "um só
 * conceito de mover valor").
 *
 * Kept here rather than duplicated per route, and rather than exported from a
 * `route.ts` file: a Next.js route module may only export the HTTP verbs (plus
 * a small allow-list of config values) — an arbitrary named export there is
 * outside that contract even where the bundler tolerates it today.
 */

import { randomUUID } from 'node:crypto'

import type { Allocation } from '@/domain/assets'
import { asId, cents, type AllocationId } from '@/domain/core'
import { getRepositories, type UserId } from '@/data'
import { NotFoundError } from '@/api/http'

export interface WireAllocation {
  readonly kind: Allocation['kind']
  readonly target: string | null
  readonly amount: number
}

/**
 * `target` is required for `Investment`/`Liability` and always `null` for
 * `Revenue` (the domain's discriminated union). The Zod schema
 * (`src/api/contracts/tangible-assets.ts`) does not enforce that pairing on the
 * wire, so a missing target here is malformed input, not a business rule the
 * domain evaluates — it is refused as `resource.not_found`, the same way an
 * id naming nothing is, rather than inventing a new validation code no source
 * asked for.
 */
export function toAllocation(input: WireAllocation): Allocation {
  const id = asId<AllocationId>(randomUUID())
  const amount = cents(input.amount)
  if (input.kind === 'Revenue') {
    return { id, kind: 'Revenue', target: null, amount }
  }
  if (input.target === null) {
    throw new Error('resource.not_found')
  }
  return input.kind === 'Investment'
    ? { id, kind: 'Investment', target: asId(input.target), amount }
    : { id, kind: 'Liability', target: asId(input.target), amount }
}

export function toAllocations(inputs: readonly WireAllocation[]): Allocation[] {
  return inputs.map(toAllocation)
}

/**
 * Refuses a Direcionamento whose `target` names an Investimento or a Passivo
 * that does not exist for THIS user.
 *
 * files_design/03 ("Objeto Direcionamento") types Destino as a reference to an
 * "Investimento ou Passivo **existente**", and the screen only ever offers ids
 * from the person's own lists — so an id naming nothing is malformed input, the
 * same `resource.not_found` `toAllocation` already answers for a missing target.
 *
 * Why it has to be checked and cannot be left to the domain: an Allocation
 * SUBTRACTS from what is still undirected (`evaluateAssetSale`), and only the
 * remainder becomes a Pendente de Direcionamento (UC37). An unresolvable target
 * therefore consumes the sale value and leaves NOTHING behind — no allocation,
 * no Pendência — which is the one outcome UC37 rules out.
 */
export async function assertAllocationTargetsExist(
  userId: UserId,
  allocations: readonly Allocation[],
): Promise<void> {
  const { investmentReader, liabilityReader } = getRepositories()
  for (const allocation of allocations) {
    const found =
      allocation.kind === 'Investment'
        ? await investmentReader.findById(userId, allocation.target)
        : allocation.kind === 'Liability'
          ? await liabilityReader.findById(userId, allocation.target)
          : // Revenue has no target: it opens the Receita form (files_design/03).
            true
    if (found === null) {
      throw new NotFoundError('O destino do direcionamento não existe.')
    }
  }
}

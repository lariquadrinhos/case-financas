/**
 * Plano de Contas — files_design/01 §3.1: "Não há opção de criar duplicata"
 * (Figma 48:2). `src/domain/chart-of-accounts/rules.ts` enforces this
 * server-side (`createCategory` → `chart_of_accounts.duplicate_name`); this is
 * the SAME check, client-side, so the person sees the message before the round
 * trip rather than only after a 409.
 *
 * Reuses the domain's own `normalizeForSearch` (accent- and case-insensitive)
 * rather than a second normalisation — the two duplicate checks must agree, or
 * a name the client accepts could still be refused by the server.
 */

import { normalizeForSearch } from '@/domain/chart-of-accounts'

export function isDuplicateCategoryName(
  existing: readonly { readonly name: string }[],
  name: string,
): boolean {
  const needle = normalizeForSearch(name)
  return existing.some((category) => normalizeForSearch(category.name) === needle)
}

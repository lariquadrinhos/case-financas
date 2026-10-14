/**
 * "Vincular ao banco" (dono, 2026-10-09) — o lado da borda: lê o que o domínio
 * precisa para escolher (`bankLinkCandidates`, src/domain/open-finance) e
 * marca, na resposta, os lançamentos que têm uma transação como testemunha.
 */

import type { EntryId } from '@/domain/core'
import type { Entry } from '@/domain/entries'
import { bankLinkCandidates } from '@/domain/open-finance'
import type { Repositories } from '@/data'
import type { UserId } from '@/data/contracts/common'

type Repos = Pick<
  Repositories,
  'entryReader' | 'importedTransactionReader' | 'openFinanceLinkReader'
>

export async function candidatesFor(repos: Repos, userId: UserId, entry: Entry) {
  const [records, links] = await Promise.all([
    repos.importedTransactionReader.listRecords(userId),
    repos.openFinanceLinkReader.list(userId),
  ])
  const kinds = new Map<string, Entry['kind']>()
  for (const record of records) {
    if (record.entryId === null || record.outcome !== 'Entry') continue
    const created = await repos.entryReader.findById(userId, record.entryId)
    if (created !== null) kinds.set(created.id, created.kind)
  }
  return bankLinkCandidates(entry, records, links, (id: EntryId) => kinds.get(id))
}

/** `linkedToBank: true` em cada lançamento que é a testemunha de uma transação. */
export async function withLinkedToBank<T extends { readonly id: string }>(
  repos: Pick<Repositories, 'importedTransactionReader'>,
  userId: UserId,
  entries: readonly T[],
): Promise<T[]> {
  const linked = new Set(
    (await repos.importedTransactionReader.listRecords(userId)).flatMap((r) =>
      r.entryId === null ? [] : [r.entryId as string],
    ),
  )
  return entries.map((entry) => (linked.has(entry.id) ? { ...entry, linkedToBank: true } : entry))
}

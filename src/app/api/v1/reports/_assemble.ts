/**
 * Read-model assembly shared by the four `/api/v1/reports/*` routes.
 *
 * Not a route itself (the leading underscore keeps Next.js from ever treating
 * it as one — see `docs/ARCHITECTURE.md`). Every report composes the SAME
 * patrimônio and chart of accounts out of several ports (`src/data/index.ts`);
 * without this file each route would re-derive that composition on its own,
 * which is exactly the kind of duplicated read-assembly this layer exists to
 * avoid (SOLID/SRP — a route handler parses, authorises, delegates and
 * serialises, nothing else, so the delegation target has to live somewhere).
 *
 * Every function here only calls repository PORTS (`@/data`) and domain types
 * — never Drizzle, never `src/data/sqlite` — so it stays on the correct side
 * of the dependency rule enforced by ESLint on `src/app/**`.
 */

import type { ChartOfAccounts } from '@/domain/chart-of-accounts'
import type { Entry } from '@/domain/entries'
import type { Occurrence, Recurrence } from '@/domain/recurrence'
import { occurrenceDescription, occurrenceOfMonth } from '@/domain/recurrence'
import type {
  BankAccount,
  Installment,
  Investment,
  Liability,
  TangibleAsset,
} from '@/domain/assets'
import {
  asId,
  type EntryId,
  type LiabilityId,
  type Month,
  type OccurrenceId,
  type RecurrenceId,
  ZERO,
} from '@/domain/core'
import type { IncomeStatementRow } from '@/domain/reports'
import { getRepositories } from '@/data'
import type { UserId } from '@/data'

export async function loadChartOfAccounts(userId: UserId): Promise<ChartOfAccounts> {
  const { statementBlockReader, categoryReader } = getRepositories()
  // ALL categories, archived included: an old month's entries may point at a
  // category archived since (files_design/01 §3.1 — archiving never deletes),
  // and the report must still resolve which block it belongs to.
  const [blocks, categories] = await Promise.all([
    statementBlockReader.list(userId),
    categoryReader.list(userId),
  ])
  return { blocks, categories }
}

/**
 * Every `Entry` whose accounting month is in `months`, PLUS a virtual Planned
 * `Entry` for each recorrência that has not been paid yet in that month — the
 * projection UC29/UC34/UC42 ask for when the seletor de mês is moved to the
 * future.
 *
 * Why this is a pure read and not "materializing occurrences" (ADR-0004
 * already answered that question, for `GET /api/v1/occurrences`, by writing a
 * row there): a report route has to stay a pure read
 * (docs/adr — "estas rotas são leitura pura, sem efeito colateral, não podem
 * escrever uma linha"). So this does NOT call `occurrenceWriter`. It reads
 * whatever is already materialized for the month (respecting anything the
 * person already discarded or edited there) and, only for a recorrência with
 * NO materialized occurrence yet for that month, computes the same pure
 * `occurrenceOfMonth` the materializing route uses — in memory, thrown away
 * after the response, never written. Two independent report requests for the
 * same never-visited future month compute the identical projection, which is
 * what makes not persisting it safe.
 *
 * Uma parcela de Passivo continua não virando Entry aqui, e agora por um motivo
 * melhor que "está em aberto": a P6 foi fechada em 2026-09-08 e decidiu que a
 * parcela CONTA no DRE — mas como parcela, não como Lançamento inventado. Ela
 * entra por `IncomeStatementInput.installments`, e a linha que o Figma 11:2
 * desenha carrega `source.kind === 'Installment'`, que é o que faz o "Editar"
 * dela apontar para o Detalhe do Passivo em vez do formulário de Lançamento.
 */
export async function loadEntriesForMonths(
  userId: UserId,
  months: readonly Month[],
): Promise<readonly Entry[]> {
  const { entryReader, recurrenceReader, occurrenceReader } = getRepositories()

  const [byMonth, openRecurrences] = await Promise.all([
    Promise.all(months.map((month) => entryReader.listByMonth(userId, month))),
    recurrenceReader.listOpen(userId),
  ])
  const realEntries = byMonth.flat()

  const projected = await Promise.all(
    months.map((month) =>
      loadProjectedEntriesForMonth(userId, month, openRecurrences, occurrenceReader),
    ),
  )

  return [...realEntries, ...projected.flat()]
}

async function loadProjectedEntriesForMonth(
  userId: UserId,
  month: Month,
  openRecurrences: readonly Recurrence[],
  occurrenceReader: ReturnType<typeof getRepositories>['occurrenceReader'],
): Promise<Entry[]> {
  const materialized = await occurrenceReader.listByMonth(userId, month)
  const materializedByRecurrence = new Map(materialized.map((o) => [o.recurrenceId, o]))

  const entries: Entry[] = []
  for (const recurrence of openRecurrences) {
    const occurrence =
      materializedByRecurrence.get(recurrence.id) ?? occurrenceOfMonth(recurrence, month)
    const entry = projectableEntry(occurrence, recurrence)
    if (entry !== null) entries.push(entry)
  }
  return entries
}

/**
 * `null` when there is nothing to project: no occurrence this month, already
 * paid (its real `Entry` is already in `realEntries`, from `entryReader`),
 * discarded ("Descartar" skips only that month, files_design/04), or a "a
 * definir" occurrence still blank (no number to show — PRD §1).
 */
function projectableEntry(occurrence: Occurrence | null, recurrence: Recurrence): Entry | null {
  if (occurrence === null) return null
  if (occurrence.status !== 'Planned') return null
  if (occurrence.discarded) return null
  if (occurrence.entryId !== null) return null
  if (occurrence.plannedAmount === null) return null
  return projectionOf(occurrence, recurrence, occurrence.plannedAmount)
}

function projectionOf(
  occurrence: Occurrence,
  recurrence: Recurrence,
  amount: Entry['amount'],
): Entry {
  return {
    ...recurrence.template,
    id: asId<EntryId>(`${PROJECTED_PREFIX}${occurrence.id}`),
    date: occurrence.plannedDate,
    status: 'Planned',
    recurrenceId: recurrence.id,
    amount,
    description: occurrenceDescription(occurrence, recurrence),
  } as Entry
}

/**
 * Os meses "a definir" ainda em branco, SÓ para a tabela "Lançamentos deste
 * mês" do DRE (relato de 2026-10-01: "minhas recorrências em a definir valor
 * não estão mostrando no lançamento do mês seguinte" — medido: 3 séries, e
 * novembro listava 8 recorrências em vez de 11). Projetados com valor zero,
 * então não mexem em número nenhum da cascata; os ids voltam para a linha ser
 * marcada "A definir". Fora do `loadEntriesForMonths` de propósito: Evolução
 * Mensal, Indicadores e Balanço não têm o que fazer com um mês sem valor.
 */
export async function loadToBeDefinedEntries(
  userId: UserId,
  month: Month,
): Promise<{ entries: Entry[]; occurrenceIds: ReadonlySet<string> }> {
  const { recurrenceReader, occurrenceReader } = getRepositories()
  const [open, materialized] = await Promise.all([
    recurrenceReader.listOpen(userId),
    occurrenceReader.listByMonth(userId, month),
  ])
  const byRecurrence = new Map(materialized.map((o) => [o.recurrenceId, o]))
  const entries: Entry[] = []
  const occurrenceIds = new Set<string>()
  for (const recurrence of open) {
    const occurrence = byRecurrence.get(recurrence.id) ?? occurrenceOfMonth(recurrence, month)
    if (occurrence === null || occurrence.plannedAmount !== null) continue
    if (occurrence.status !== 'Planned' || occurrence.discarded || occurrence.entryId !== null) {
      continue
    }
    entries.push(projectionOf(occurrence, recurrence, ZERO))
    occurrenceIds.add(occurrence.id)
  }
  return { entries, occurrenceIds }
}

export interface PatrimonioInputs {
  readonly bankAccounts: readonly BankAccount[]
  readonly investments: readonly Investment[]
  readonly tangibleAssets: readonly TangibleAsset[]
  readonly liabilities: readonly Liability[]
  readonly installmentsByLiability: ReadonlyMap<LiabilityId, readonly Installment[]>
}

/**
 * Everything `computeBalanceSheet` (and, flattened, `computeFinancialIndicators`)
 * needs about accounts, investments, bens materiais and dívidas.
 *
 * `tangibleAssets` is EVERY one, sold included: `computeBalanceSheet` filters
 * the sold ones out itself (its own header comment), so listing only the
 * unsold ones here would just move that filter to the wrong layer.
 */
export async function loadPatrimonio(userId: UserId): Promise<PatrimonioInputs> {
  const {
    bankAccountReader,
    investmentReader,
    tangibleAssetReader,
    liabilityReader,
    installmentReader,
  } = getRepositories()

  const [bankAccounts, investments, tangibleAssets, liabilities] = await Promise.all([
    bankAccountReader.list(userId),
    investmentReader.list(userId),
    tangibleAssetReader.list(userId),
    liabilityReader.list(userId),
  ])

  const schedules = await Promise.all(
    liabilities.map((liability) => installmentReader.listByLiability(userId, liability.id)),
  )
  const installmentsByLiability = new Map(
    liabilities.map((liability, index) => [liability.id, schedules[index] ?? []]),
  )

  return { bankAccounts, investments, tangibleAssets, liabilities, installmentsByLiability }
}

const PROJECTED_PREFIX = 'projected:'

/** The id an open occurrence carries while projected as a Lançamento of its month. */
export function projectedEntryIdOf(occurrenceId: string): string {
  return `${PROJECTED_PREFIX}${occurrenceId}`
}

/**
 * The rows of a projected Previsto point at its OCCURRENCE, not at a
 * Lançamento. `projectableEntry` above gives the projection a synthetic
 * `projected:<occurrence>` id so the pure calculation can treat it as an Entry;
 * that id must not leave the server as an `entryId`. Measured on 2026-09-29:
 * the DRE's "Editar" opened /novo-lancamento with it and answered "Não foi
 * possível carregar este lançamento", and "Marcar Pago" posted to an entry
 * that does not exist. This module owns the convention, so it undoes it here.
 */
export function withOccurrenceSources<T extends { rows: readonly IncomeStatementRow[] }>(
  statement: T,
  /** Ocorrências "a definir" em branco: a linha sai marcada `amountToBeDefined`. */
  toBeDefined: ReadonlySet<string> = new Set(),
): T {
  return {
    ...statement,
    rows: statement.rows.map((row) => {
      if (row.source.kind !== 'Entry' || !row.source.entryId.startsWith(PROJECTED_PREFIX)) {
        return row
      }
      const occurrenceId = row.source.entryId.slice(PROJECTED_PREFIX.length)
      const recurrenceId = occurrenceId.slice(0, occurrenceId.lastIndexOf(':'))
      return {
        ...row,
        source: {
          kind: 'Occurrence' as const,
          occurrenceId: asId<OccurrenceId>(occurrenceId),
          recurrenceId: asId<RecurrenceId>(recurrenceId),
        },
        ...(toBeDefined.has(occurrenceId) ? { amountToBeDefined: true } : {}),
      }
    }),
  }
}

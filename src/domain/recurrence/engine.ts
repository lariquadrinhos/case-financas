/**
 * Motor de recorrência — hotspot H4 (Event Storming, Fluxo D; PRD §5).
 *
 * Every function here is pure and deterministic. The engine never reads a
 * clock: the caller says how far to project (`until`), which is what makes a
 * twelve-instalment plan and a February 29th testable without freezing time
 * (src/domain/README.md "A regra de dependência").
 *
 * Three verbs that the product deliberately keeps apart
 * (files_design/04 "Ações e sub-elementos"):
 *   - **Descartar** (`discardOccurrence`) skips ONE month; the series continues.
 *   - **Encerrar** (`closeRecurrence`) stops the series for good.
 *   - **Término** (`endsOn`) is the date of the last occurrence, chosen upfront
 *     when the series is a parcelamento (PRD UC15).
 */

import {
  addMonths,
  asId,
  monthOf,
  sameDayInAnotherMonth,
  type Cents,
  type IsoDate,
  type Month,
  type OccurrenceId,
  type RecurrenceId,
  subtract,
} from '@/domain/core'
import type { NewEntry } from '@/domain/entries'

import type { EditScope, Occurrence, Recurrence, RecurrenceTemplate } from './types'

/**
 * The id of a generated occurrence.
 *
 * It is derived, not drawn: the engine is pure, so it has no `Math.random()`
 * and no counter. The pair (series, month) is unique by construction — a
 * recurrence produces at most one occurrence per month — so it is already the
 * natural key, and deriving it keeps `generateOccurrences` idempotent: calling
 * it twice for the same `until` yields the same ids, which is what lets a stored
 * occurrence be matched back to the one the engine projects.
 *
 * ADR-0004 §2 fixou essa derivação como a decisão, não como um provisório: é ela
 * que permite reconhecer, numa ocorrência guardada, a mesma que o motor projeta
 * (§1 gera virtualmente, §3 materializa na visita). Um id sorteado pelo
 * repositório quebraria a reconciliação entre as duas.
 */
export function occurrenceIdOf(recurrence: Recurrence, month: Month): OccurrenceId {
  return occurrenceIdFor(recurrence.id, month)
}

/**
 * Same derivation as `occurrenceIdOf`, taking the id directly instead of the
 * whole series — what a repository adapter has on hand when it materialises an
 * occurrence the engine has not built yet (`OccurrenceWriter.create`), without
 * having to reconstruct a `Recurrence` just to read one field off it.
 */
export function occurrenceIdFor(recurrenceId: RecurrenceId, month: Month): OccurrenceId {
  return asId<OccurrenceId>(`${recurrenceId}:${month}`)
}

/** The month the series starts in — the month of its first occurrence. */
export function startMonthOf(recurrence: Recurrence): Month {
  return monthOf(recurrence.startDate)
}

/**
 * How many months separate two months. `until` before `from` gives a negative
 * number, which the callers below read as "the series has not started yet".
 */
function monthsBetween(from: Month, to: Month): number {
  const years = Number(to.slice(0, 4)) - Number(from.slice(0, 4))
  return years * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))
}

/**
 * The date the Nth occurrence falls on. `sameDayInAnotherMonth` clamps the day
 * to the length of the target month, so a series born on the 31st lands on
 * 28/29 February and returns to the 31st in March — it never spills into the
 * next month (core/time.ts).
 */
function dateOfOccurrence(recurrence: Recurrence, offset: number): IsoDate {
  return sameDayInAnotherMonth(recurrence.startDate, offset)
}

/**
 * The last date the series may still produce an occurrence on, or `null` when
 * it runs indefinitely.
 *
 * `endsOn` is "Término (data da última ocorrência)" (files_design/02) and
 * `closedOn` is "Encerrar recorrência"; both are compared against the
 * occurrence's own date, and when both exist the earlier one wins — closing a
 * parcelamento early must not resurrect the months the término already cut off.
 */
function lastAllowedDate(recurrence: Recurrence): IsoDate | null {
  const { endsOn, closedOn } = recurrence
  if (endsOn === null) return closedOn
  if (closedOn === null) return endsOn
  return closedOn < endsOn ? closedOn : endsOn
}

/**
 * The amount an occurrence is born with.
 *
 * `Fixed` copies the value the person typed; `ToBeDefined` is born blank every
 * month and stays a pending Previsto until it is filled in — it never blocks
 * the month, because Previsto does not enter the DRE (PRD §1 and §5).
 */
function initialAmountOf(recurrence: Recurrence): Cents | null {
  return recurrence.amountKind === 'Fixed' ? recurrence.template.amount : null
}

function buildOccurrence(recurrence: Recurrence, month: Month, offset: number): Occurrence {
  return {
    id: occurrenceIdOf(recurrence, month),
    recurrenceId: recurrence.id,
    month,
    plannedDate: dateOfOccurrence(recurrence, offset),
    plannedAmount: initialAmountOf(recurrence),
    // Every generated occurrence is born Previsto; only "Marcar Pago" moves it.
    status: 'Planned',
    discarded: false,
    entryId: null,
  }
}

/**
 * Every occurrence the series produces from its start up to and including
 * `until`, in chronological order (Event Storming Fluxo D 🟪).
 *
 * The projection stops at whichever comes first: `until`, the término, or the
 * date the series was closed on. A series with neither término nor closing runs
 * indefinitely, which is exactly why `until` is a required parameter and not a
 * default — the caller, not the engine, decides how far the future goes.
 */
export function generateOccurrences(recurrence: Recurrence, until: Month): Occurrence[] {
  const start = startMonthOf(recurrence)
  const span = monthsBetween(start, until)
  if (span < 0) return []

  const limit = lastAllowedDate(recurrence)
  const occurrences: Occurrence[] = []
  for (let offset = 0; offset <= span; offset += 1) {
    const date = dateOfOccurrence(recurrence, offset)
    // "Data da última ocorrência" is a date, so the cut is on the date, not on
    // the month: a series on the 31st with término on the 15th does not sneak
    // one last occurrence into that month (files_design/02 §"Término").
    if (limit !== null && date > limit) break
    occurrences.push(buildOccurrence(recurrence, addMonths(start, offset), offset))
  }
  return occurrences
}

/** The occurrence a single series produces in `month`, or `null` if it produces none. */
export function occurrenceOfMonth(recurrence: Recurrence, month: Month): Occurrence | null {
  const offset = monthsBetween(startMonthOf(recurrence), month)
  if (offset < 0) return null

  const date = dateOfOccurrence(recurrence, offset)
  const limit = lastAllowedDate(recurrence)
  if (limit !== null && date > limit) return null

  return buildOccurrence(recurrence, month, offset)
}

/**
 * What the Revisão de Recorrentes screen lists for a month: one line per series
 * that is alive in it, ordered by planned date (files_design/01 §6).
 *
 * The month selector navigates backwards and forwards, so this is asked for
 * past months as well — the engine answers the same way for any month, since
 * nothing here depends on "today".
 */
export function occurrencesOfMonth(recurrences: readonly Recurrence[], month: Month): Occurrence[] {
  return recurrences
    .map((recurrence) => occurrenceOfMonth(recurrence, month))
    .filter((occurrence): occurrence is Occurrence => occurrence !== null)
    .sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : a.plannedDate > b.plannedDate ? 1 : 0))
}

/**
 * "Em aberto": still Previsto and not skipped. This is the reach of a
 * "Toda a série (valores em aberto)" edit, which files_design/02 defines by
 * STATUS and not by time — a late occurrence (its month has passed but it is
 * still Previsto) is in scope, a Pago one never is.
 */
export function isOpen(occurrence: Occurrence): boolean {
  return occurrence.status === 'Planned' && !occurrence.discarded
}

/**
 * The recorrências "a definir" the person has not filled in yet — the
 * "Recorrentes pendentes" line of the Home's Pendências card
 * (files_design/01 §2, PRD §1: it does not block the month).
 */
export function pendingWithoutAmount(occurrences: readonly Occurrence[]): Occurrence[] {
  return occurrences.filter((occurrence) => isOpen(occurrence) && occurrence.plannedAmount === null)
}

/**
 * What "Editar" changes on the Revisão de Recorrentes.
 *
 * The screen's edit is a Valor field (files_design/02 §"Unificação: parcelas de
 * Passivo…": "'Editar' abre um campo de Valor editável + a pergunta 'só esta
 * ocorrência ou série toda'"). `null` puts the occurrence back to pending,
 * which is the state a "a definir" series is born in.
 *
 * The amount is the WHOLE of it, and that is drawn, not assumed. The "Editar"
 * panel is card `34:24` in column ② (`34:21`) of Wireframe `34:2`
 * (docs/figma/frames/34-2__estado-3-acoes-da-revisao-de-recorrentes.xml): one
 * single field, `144:3` "Valor *" with its box `144:4`/`144:5`, then `34:25`
 * "Aplicar esta mudança a:" and the two rows `34:27`/`34:29`. No planned date,
 * no category, no conta, no "Tipo de valor" — the card's content ends at y=188
 * of 202, exactly its 14 of bottom padding. files_design/01 §6's "muda
 * valor/dados" is the loose phrase; the frame is the specification.
 */
export interface OccurrenceChange {
  readonly plannedAmount: Cents | null
  /**
   * The Descrição (2026-10-01). `ThisOnly` keeps it on the occurrence;
   * `WholeSeries` writes it into the template. Absent: unchanged.
   */
  readonly description?: string | null
  /**
   * The series' data — category, conta, entidade… (2026-10-01). Only with
   * `WholeSeries`: an occurrence stores a value and a date, nothing else, so
   * "this month only" has nowhere to keep a different category. Its `kind`
   * must be the series' own; its `amount` yields to `plannedAmount`.
   */
  readonly template?: RecurrenceTemplate
}

/** A "Toda a série" edit rewrites the template as well; a "Só esta" edit does not. */
export interface EditResult {
  readonly recurrence: Recurrence
  readonly occurrences: readonly Occurrence[]
}

export interface EditOccurrenceCommand {
  readonly recurrence: Recurrence
  /** The series as it stands, including the occurrence being edited. */
  readonly occurrences: readonly Occurrence[]
  readonly occurrenceId: OccurrenceId
  readonly change: OccurrenceChange
  readonly scope: EditScope
}

function withAmount(occurrence: Occurrence, plannedAmount: Cents | null): Occurrence {
  return { ...occurrence, plannedAmount }
}

function templateWithAmount(recurrence: Recurrence, amount: Cents | null): RecurrenceTemplate {
  const template = recurrence.template

  // Clearing the value of a single occurrence says nothing about the series'
  // own value, so a null change leaves the template alone.
  if (amount === null) return template

  // A "a definir" series has no series-level value to rewrite. The tooltip that
  // defines the two kinds (Wireframe `71:11`, card `74:14`, texts `75:2`/`75:3`)
  // says "Fixo: o valor se repete igualmente todo mês. A definir: o valor sofre
  // alterações e deve ser informado a cada mês" — only the Fixo template holds a
  // number that every month copies. Writing one here was provably inert anyway:
  // `template.amount` is read in exactly one place in the codebase,
  // `initialAmountOf` (engine.ts), behind `amountKind === 'Fixed'` — grepped, not
  // deduced. Inert state that outlives the edit is the kind a later "Tipo de
  // valor" change silently resurrects, so it is not written at all.
  if (recurrence.amountKind !== 'Fixed') return template

  return { ...template, amount }
}

/**
 * PRD UC14 — the person edits one occurrence and chooses the reach of the change.
 *
 * `ThisOnly` touches that occurrence and nothing else. `WholeSeries` rewrites
 * the template, so every month generated from now on carries the new value, and
 * applies the same change to the occurrences that are still em aberto. An
 * occurrence already marked Pago is never rewritten: it is a Lançamento in the
 * DRE already (docs/ARCHITECTURE.md §"Marcar uma recorrência como paga"), and
 * editing the series must not restate a payment that happened.
 *
 * A WholeSeries edit never flips `amountKind`, and that is drawn, not assumed.
 * The tooltip for "Tipo de valor" (Wireframe `71:11`, card `74:14` "④ Hover:
 * Tipo de valor (recorrência)", texts `75:2`-`75:6`; transcribed word for word
 * in files_design/02 §"Ícone 'i' de ajuda contextual") defines the two kinds by
 * what happens EVERY month: "Fixo: o valor se repete igualmente todo mês. A
 * definir: o valor sofre alterações e deve ser informado a cada mês." Filling
 * one month in does not make the next month stop varying, so a `ToBeDefined`
 * series stays `ToBeDefined` and is born blank again (PRD §5 "Motor de
 * recorrência": "fixa = valor copiado; a definir = em branco"). Changing the
 * kind is a "Tipo de valor" change, and that control lives in the RECORRÊNCIA
 * block of the entry form (frame `262:873`, node `67:8`, segments `67:11`
 * "Fixo (copia o valor)" / `67:13` "A definir (em branco)"), never in this quick
 * edit — the "② Editar" card `34:21` of frame `34:2` draws one field, `144:3`
 * "Valor *", and the two scope rows `34:27`/`34:29`.
 *
 * Nor does the person get stuck re-answering the same pendência every month:
 * `34:29` "Toda a série (valores em aberto)" reaches every occurrence still
 * Previsto, the late ones included (files_design/02) — that is what this
 * function's `isOpen` filter is.
 */
export function editOccurrence(command: EditOccurrenceCommand): EditResult {
  const { recurrence, occurrences, occurrenceId, change, scope } = command

  const target = occurrences.find((occurrence) => occurrence.id === occurrenceId)
  if (target === undefined) {
    throw new Error('recurrence.occurrence_not_found')
  }
  if (target.recurrenceId !== recurrence.id) {
    throw new Error('recurrence.occurrence_of_another_series')
  }
  if (!isOpen(target)) {
    throw new Error('recurrence.occurrence_not_open')
  }

  if (change.template !== undefined && change.template.kind !== recurrence.template.kind) {
    // Same rule as PATCH /entries: a despesa that becomes a receita is a
    // different transaction, discarded and created again.
    throw new Error('recurrence.kind_change')
  }

  if (scope === 'ThisOnly') {
    if (change.template !== undefined) {
      throw new Error('recurrence.this_only_changes_amount_and_description')
    }
    return {
      recurrence,
      occurrences: occurrences.map((occurrence) => {
        if (occurrence.id !== occurrenceId) return occurrence
        const withValue = withAmount(occurrence, change.plannedAmount)
        return change.description === undefined
          ? withValue
          : { ...withValue, description: change.description }
      }),
    }
  }

  const base: Recurrence =
    change.template === undefined ? recurrence : { ...recurrence, template: change.template }
  const template = templateWithAmount(
    // The amount the person typed is `plannedAmount`; the template's own
    // `amount` field follows it, never the other way round.
    { ...base, template: { ...base.template, amount: recurrence.template.amount } },
    change.plannedAmount,
  )
  return {
    recurrence: {
      ...base,
      template:
        change.description === undefined
          ? template
          : { ...template, description: change.description },
    },
    occurrences: occurrences.map((occurrence) => {
      if (occurrence.recurrenceId !== recurrence.id || !isOpen(occurrence)) return occurrence
      const withValue = withAmount(occurrence, change.plannedAmount)
      // A new series Descrição reaches the open months: a month's own one
      // would hide it ("Toda a série" means the whole series).
      return change.description === undefined ? withValue : { ...withValue, description: null }
    }),
  }
}

/**
 * "Descartar" — skip THIS month only. The series is untouched and produces its
 * next occurrence normally (files_design/01 §6; files_design/04: "'Descartar' ≠
 * 'Encerrar recorrência' — o primeiro pula só 1 mês, o segundo para a série pra
 * sempre"). Available for Fixo and A definir alike (files_design/02: "a pessoa
 * pode querer pular uma ocorrência de valor fixo também").
 *
 * Note what this function does NOT return: a `Recurrence`. Discarding cannot
 * reach the series — that is the whole distinction from `closeRecurrence`.
 */
export function discardOccurrence(occurrence: Occurrence): Occurrence {
  if (occurrence.status === 'Paid') {
    // A Pago occurrence is already a Lançamento in the DRE; "Descartar" is
    // offered on the checklist of Previsto occurrences (files_design/01 §6).
    throw new Error('recurrence.cannot_discard_paid_occurrence')
  }
  return { ...occurrence, discarded: true }
}

/**
 * "Encerrar recorrência" — stop the series for good, from `closedOn` onwards
 * (files_design/01 §5.4; files_design/04). This is the action that lives in the
 * full edit form, not on the Revisão de Recorrentes, precisely because it is the
 * definitive one.
 *
 * Note what this function does NOT return: an `Occurrence`. Closing never edits
 * a month that already exists — occurrences dated on or before `closedOn`,
 * including ones already Pago, stay exactly as they are.
 */
export function closeRecurrence(recurrence: Recurrence, closedOn: IsoDate): Recurrence {
  if (recurrence.closedOn !== null) {
    throw new Error('recurrence.already_closed')
  }
  return { ...recurrence, closedOn }
}

/**
 * What "Encerrar recorrência" does to occurrences ALREADY materialized after
 * `closedOn`: the still-open ones are discarded, so the Revisão de Recorrentes
 * stops asking to pay a series that is over. Paid ones stay — they are
 * Lançamentos. Measured 2026-09-23: closing only set `closedOn`, and a
 * materialized later occurrence kept showing up (files_design/04).
 */
export function occurrencesDiscardedByClosure(
  occurrences: readonly Occurrence[],
  closedOn: IsoDate,
): Occurrence[] {
  return occurrences
    .filter(
      (occurrence) =>
        occurrence.plannedDate > closedOn &&
        occurrence.status === 'Planned' &&
        occurrence.entryId === null &&
        !occurrence.discarded,
    )
    .map((occurrence) => ({ ...occurrence, discarded: true }))
}

/**
 * The template a new series starts from, out of the entry the person is
 * creating right now (files_design/03 "Objeto Recorrência": ativar a
 * recorrência é um toggle no MESMO formulário de lançamento, não uma tela
 * própria). `RecurrenceTemplate` is `NewEntry` minus the three fields that
 * belong to a single month; the destructure drops exactly those three,
 * regardless of which of the five kinds `entry` is — the discriminant and every
 * kind-specific field ride along in `...template` untouched.
 */
export function templateFromEntry(entry: NewEntry): RecurrenceTemplate {
  const { date: _date, status: _status, recurrenceId: _recurrenceId, ...template } = entry
  // "Contabilizar em" is a single month too (ADR-0021): copied into the
  // series, it would pile every occurrence into that one month.
  if ('accountingMonth' in template) {
    const { accountingMonth: _accountingMonth, ...rest } = template
    return rest as RecurrenceTemplate
  }
  return template as RecurrenceTemplate
}

/**
 * "Descontar da próxima ocorrência" — ADR-0017 §5, files_design/03 "Marcar
 * Pago": pagar a mais dá três saídas, e esta "reduz o valor previsto do mês
 * seguinte".
 *
 * A fonte especifica o caminho feliz e só ele. As três bordas abaixo foram
 * medidas no modelo (uma série tem `endsOn`, um `ToBeDefined` tem
 * `plannedAmount: null`, e nada limita o excesso) e **recusam**, por decisão de
 * produto de 2026-09-11 — em vez de descontar "o que couber", que faria sumir
 * em silêncio a parte que não coube, num fluxo cuja regra é justamente que
 * pagar a mais NUNCA vira pendência.
 *
 * Quem chama valida ANTES de gravar qualquer coisa: recusar depois de já ter
 * registrado o pagamento deixaria a pessoa com um pagamento gravado e um erro
 * na tela, e repetir o envio gravaria o pagamento duas vezes.
 */
export function deductFromNextOccurrence(next: Occurrence | null, excess: Cents): Occurrence {
  if (next === null) {
    throw new Error('recurrence.no_next_occurrence')
  }
  if (!isOpen(next)) {
    throw new Error('recurrence.occurrence_not_open')
  }
  if (next.plannedAmount === null) {
    throw new Error('recurrence.next_amount_to_be_defined')
  }
  if (excess > next.plannedAmount) {
    throw new Error('recurrence.deduction_does_not_fit')
  }
  return withAmount(next, subtract(next.plannedAmount, excess))
}

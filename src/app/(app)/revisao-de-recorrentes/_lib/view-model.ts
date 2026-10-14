/**
 * Pure view-model for Revisão de Recorrentes — no fetch, no React, so the two
 * rules that matter most on this screen are unit-testable on their own
 * (CLAUDE.md §8: "defina o contrato antes da implementação").
 */

import { type Cents, type Month, LABEL_ENTITY, LABEL_ENTRY_KIND, cents } from '@/domain/core'
import type {
  Category,
  Installment,
  Liability,
  Occurrence,
  Recurrence,
  StatementBlock,
} from './queries'

/**
 * files_design/03 "Marcar Pago": which of the three payment-outcome branches
 * applies, decided ONLY by the sign of (pago − previsto). `NoBaseline` is the
 * "a definir" occurrence paid for the first time — there is nothing to
 * diverge from (PRD §5), so it behaves exactly like `Exact` in the dialog
 * (confirm and close), but is kept distinct so a caller can tell the two
 * apart if it ever needs to (no comparison happened here, one happened to match there).
 */
export type PaymentClassification = 'Exact' | 'Underpaid' | 'Overpaid' | 'NoBaseline'

export function classifyPayment(
  plannedAmount: Cents | null,
  paidAmount: Cents,
): PaymentClassification {
  if (plannedAmount === null) return 'NoBaseline'
  if (paidAmount < plannedAmount) return 'Underpaid'
  if (paidAmount > plannedAmount) return 'Overpaid'
  return 'Exact'
}

function amountKindWord(amountKind: Recurrence['amountKind']): string {
  return amountKind === 'Fixed' ? 'fixo' : 'a definir'
}

/**
 * Title + subtitle for one occurrence's row, derived from its série's
 * template — files_design/01 §6 draws "Aluguel / PJ · Despesas
 * Administrativas · valor fixo" but no doc gives the exact algorithm, so this
 * is written from that mockup and the glossário closed vocabulary (never
 * "Intercompany" — files_design/04).
 */
function describeTemplate(
  recurrence: Recurrence,
  amountKind: Recurrence['amountKind'],
  categoriesById: ReadonlyMap<string, Category>,
  blocksById: ReadonlyMap<string, StatementBlock>,
): { title: string; subtitle: string } {
  const template = recurrence.template
  const kindLabel = LABEL_ENTRY_KIND[template.kind]
  const word = amountKindWord(amountKind)

  if (template.kind === 'Expense' || template.kind === 'Revenue') {
    const category = categoriesById.get(template.categoryId)
    const block = category ? blocksById.get(category.blockId) : undefined
    return {
      title: category?.name ?? kindLabel,
      subtitle: `${LABEL_ENTITY[template.entity]} · ${block?.name ?? '—'} · valor ${word}`,
    }
  }

  if (template.kind === 'ProLabore' || template.kind === 'ProfitDistribution') {
    // files_design/04: "Intercompany" foi descartado como rótulo — "Pró-labore
    // e Distribuição" é o termo fechado do glossário para as duas transações.
    return { title: kindLabel, subtitle: `Pró-labore e Distribuição · valor ${word}` }
  }

  // IncomeTax: sem Categoria (é exatamente por isso que carrega Rótulo, files_design/03).
  return {
    title: template.label ?? kindLabel,
    subtitle: `${LABEL_ENTITY[template.entity]} · ${kindLabel} · valor ${word}`,
  }
}

export interface OccurrenceRow {
  readonly kind: 'Occurrence'
  readonly id: string
  readonly occurrence: Occurrence
  readonly recurrence: Recurrence
  readonly title: string
  readonly subtitle: string
  readonly amount: Cents | null
  readonly plannedDate: string
}

export interface InstallmentRow {
  readonly kind: 'Installment'
  readonly id: string
  readonly installment: Installment
  readonly liability: Liability
  readonly title: string
  readonly subtitle: string
  readonly amount: Cents
  readonly plannedDate: string
}

export type ReviewRow = OccurrenceRow | InstallmentRow

export interface BuildReviewRowsInput {
  readonly occurrences: readonly Occurrence[]
  readonly recurrences: readonly Recurrence[]
  readonly categories: readonly Category[]
  readonly statementBlocks: readonly StatementBlock[]
  readonly liabilities: readonly Liability[]
  readonly installmentsByLiability: Readonly<Record<string, readonly Installment[]>>
  readonly month: Month | string
}

function byPlannedDateThenTitle(a: ReviewRow, b: ReviewRow): number {
  if (a.plannedDate !== b.plannedDate) return a.plannedDate < b.plannedDate ? -1 : 1
  return a.title.localeCompare(b.title, 'pt-BR')
}

/**
 * files_design/01 §6: "Parcelas de Passivo também aparecem nesta lista, no
 * mesmo formato" — one flat, combined list.
 *
 * A ORDEM É DESENHO, não escolha nossa: as duas páginas do Figma põem as
 * Ocorrências primeiro e a Parcela de Passivo por último.
 *  - Wireframe `10:2`: a parcela mora em `144:6`, um container IRMÃO e
 *    POSTERIOR à lista de ocorrências `10:27` (x=48 y=213 h=350, termina em
 *    y=563). `144:6` começa em y=583 — 20px de intervalo, contra os 10px que
 *    separam as 5 linhas de 62px DENTRO de `10:27` (y=0, 72, 144, 216, 288).
 *    O intervalo maior e o container separado são o agrupamento desenhado.
 *  - Mockup `822:410`: um card só (`822:528`), e `822:604` ("Financiamento
 *    apartamento, parcela 13/360") é a SEXTA e última "Linha da tabela",
 *    depois de Aluguel/Academia/Internet/Pró-labore/Contador — e a única com
 *    a célula de ações larga (`822:614` w=337, botão do meio de 107px =
 *    "Editar juros", contra w=301 e 71px nas outras cinco).
 *
 * Nenhum dos dois frames desenha data em linha alguma — não há coluna de
 * data. Por isso a data NÃO pode ordenar a lista inteira: ordená-la por
 * `plannedDate` intercalava a parcela no meio das ocorrências (uma parcela
 * vencendo dia 10 subia acima de recorrências do dia 20), estado que nenhum
 * frame desenha. A data ordena apenas DENTRO de cada grupo, porque aí os
 * frames são silentes e só falta um critério determinístico.
 */
export function buildReviewRows(input: BuildReviewRowsInput): ReviewRow[] {
  const categoriesById = new Map(input.categories.map((category) => [category.id, category]))
  const blocksById = new Map(input.statementBlocks.map((block) => [block.id, block]))
  const recurrencesById = new Map(
    input.recurrences.map((recurrence) => [recurrence.id, recurrence]),
  )

  const occurrenceRows: OccurrenceRow[] = []
  for (const occurrence of input.occurrences) {
    const recurrence = recurrencesById.get(occurrence.recurrenceId)
    if (recurrence === undefined) continue
    const { title, subtitle } = describeTemplate(
      recurrence,
      recurrence.amountKind,
      categoriesById,
      blocksById,
    )
    occurrenceRows.push({
      kind: 'Occurrence',
      id: occurrence.id,
      occurrence,
      recurrence,
      title,
      subtitle,
      amount: occurrence.plannedAmount === null ? null : cents(occurrence.plannedAmount),
      plannedDate: occurrence.plannedDate,
    })
  }

  const installmentRows: InstallmentRow[] = []
  for (const liability of input.liabilities) {
    const installments = input.installmentsByLiability[liability.id] ?? []
    for (const installment of installments) {
      // Comparing the first 7 chars of "YYYY-MM-DD" is `monthOf` inlined: this
      // module stays framework/domain-free on purpose (pure, unit-testable
      // with plain strings, no branded `IsoDate` construction in a test file).
      if (installment.plannedDate.slice(0, 7) !== input.month) continue
      // "Descartar" tira a parcela da revisão DESTE mês (Figma `10:2` nó
      // 144:17, diálogo `34:2` nó 34:36) — mesma regra que
      // `GET /occurrences` já aplica a uma ocorrência descartada.
      if (installment.discarded) continue
      installmentRows.push({
        kind: 'Installment',
        id: installment.id,
        installment,
        liability,
        title: `${liability.name}, parcela ${installment.number}/${liability.installmentCount}`,
        subtitle: `Passivo · ${liability.creditor} · valor calculado (amortização)`,
        amount: cents(installment.plannedAmount),
        plannedDate: installment.plannedDate,
      })
    }
  }

  return [
    ...occurrenceRows.sort(byPlannedDateThenTitle),
    ...installmentRows.sort(byPlannedDateThenTitle),
  ]
}

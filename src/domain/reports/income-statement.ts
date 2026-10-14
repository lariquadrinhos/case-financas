/**
 * DRE — the full cascade (files_design/01 §8.1, Figma 11:2).
 *
 * The statement is a PROJECTION, never a source of truth: delete it, recompute
 * it, and the numbers are identical. That is what lets a past month be edited
 * and recalculated in cascade (Event Storming H8, resolved: no month is locked).
 *
 * The intercompany elimination is NOT implemented here. It is imported from
 * `@/domain/entries`, which is the single place that decides how an entry reads
 * in each view. Two implementations of that rule is the failure H2 warns about.
 */

import { isUncategorized } from '@/domain/chart-of-accounts'
import {
  type Cents,
  type Entity,
  type EntryStatus,
  type Month,
  type View,
  ZERO,
  add,
  cents,
  compareMonths,
  isNegative,
  monthOf,
  negate,
} from '@/domain/core'
import type { Installment, Liability } from '@/domain/assets'
import {
  BLOCK_IDS,
  blockOfCategory,
  type CascadeEffect,
  type ChartOfAccounts,
  type StatementBlock,
} from '@/domain/chart-of-accounts'
import {
  type Entry,
  type EntryRole,
  accountingMonth,
  effectInView,
  entersIncomeStatement,
} from '@/domain/entries'
import {
  LABEL_STATEMENT_SUBTOTAL,
  type IncomeStatement,
  type IncomeStatementRow,
  type StatementLine,
} from './types'

export interface IncomeStatementInput {
  readonly entries: readonly Entry[]
  readonly chart: ChartOfAccounts
  readonly view: View
  readonly month: Month
  readonly statusFilter: EntryStatus
  /**
   * "Ver previsão do mês" (2026-09-23): pago E previsto, como o mês vai fechar.
   * Quando ligado, `statusFilter` não restringe nada. Pago e Previsto seguem
   * exclusivos fora deste modo (files_design/01 §8.1, PRD §1).
   */
  readonly forecast?: boolean
  /**
   * Simulação "e se" do DRE (pedido do dono, 2026-10-01: "um ícone de olhinho
   * que eu possa ocultar um valor para ver como ficaria o DRE sem esse valor,
   * ou uma categoria toda"). `rows`: ids de lançamento ou parcela. `groups`:
   * chaves do detalhamento do bloco (`category:<id>`, `kind:<…>`,
   * `liability:<id>`). O oculto sai da cascata e continua listado, marcado
   * `hidden`. Nada é gravado: é a pessoa olhando o mês de outro jeito.
   */
  readonly hidden?: {
    readonly rows?: ReadonlySet<string>
    readonly groups?: ReadonlySet<string>
  }
  /**
   * P6 (produto, 2026-09-08): a parcela de Passivo CONTA no DRE, em Despesas
   * Administrativas, pelo valor cheio. É o que a planilha de referência faz —
   * `(-) Financiamento imóvel/veículo` no bloco 4 está preenchida todo mês, e
   * `(-) Juros do financiamento` no bloco 8 está zerada, ou seja, a referência
   * não separa juros. Sem isso o DRE subestimava a despesa do mês pela parcela
   * inteira e superestimava o Lucro Líquido, que é o número que alimenta o
   * "Destinar este Lucro".
   *
   * Recebe os agregados inteiros e filtra aqui, como `computeBalanceSheet` faz
   * com `tangibleAssets`: quem chama não precisa saber a regra de mês.
   *
   * O que o PRD §5 proíbe é a direção oposta — registrar despesa não constrói
   * passivo. Contar uma parcela como despesa não constrói nada.
   */
  /**
   * The DRE's "Recorrentes" and "Cartão" filters (owner, 2026-10-06): the
   * cascade is RECALCULATED over only the matching Lançamentos, like the
   * "olhinho" simulation — the owner chose that over a filter that only hides
   * rows. Both on means both must match. A parcela de Passivo is neither a
   * série nor a card, so any filter leaves it out.
   */
  readonly only?: { readonly recurring?: boolean; readonly creditCard?: boolean }
  readonly liabilities?: readonly Liability[]
  readonly installments?: readonly Installment[]
}

/**
 * Which block an accounting role lands in.
 *
 * `entries` names the ROLE and stops there, because it may not import
 * `chart-of-accounts` (src/domain/README.md). Resolving the role to a block is
 * the report's job, and this function is where the two meet.
 */
function blockForRole(role: EntryRole, entry: Entry, chart: ChartOfAccounts): StatementBlock {
  switch (role) {
    case 'Category': {
      if (!('categoryId' in entry)) throw new Error('income_statement.role_without_category')
      const block = blockOfCategory(chart, entry.categoryId)
      // A category pointing at no block is a broken reference, not a zero.
      // Swallowing it here would make money disappear from the statement.
      if (block === null) throw new Error('income_statement.category_without_block')
      return block
    }
    case 'GrossRevenue':
      return requireBlock(chart, BLOCK_IDS.grossRevenue)
    case 'OperatingExpense':
      // PRD §5 / §9.2 P1 — decisão de produto de 2026-09-08, depois de a lacuna
      // ficar aberta porque NENHUMA fonte a fechava: o PRD repete
      // "despesa/custo operacional" seis vezes sem nomear o bloco, e a planilha
      // de referência (docs/reference/meu-dre.xlsx) não desempata — ela é uma
      // visão única, com pró-labore aparecendo uma vez só, como RECEITA no
      // bloco 1; os blocos 3 e 4 não têm linha de pró-labore nenhuma. A visão
      // isolada da PJ é do produto, não da planilha.
      //
      // Despesas Administrativas, porque pró-labore é remuneração do dono e não
      // custo direto de entregar o serviço — e o CSV da planilha guarda só
      // ferramenta e serviço (assinaturas, streaming, academia, Contador, internet),
      // nenhuma linha de mão de obra.
      return requireBlock(chart, BLOCK_IDS.administrativeExpenses)
    case 'ProfitAllocation':
      return requireBlock(chart, BLOCK_IDS.profitAllocation)
    case 'ProfitTaxes':
      return requireBlock(chart, BLOCK_IDS.profitTaxes)
  }
}

function requireBlock(chart: ChartOfAccounts, id: StatementBlock['id']): StatementBlock {
  const block = chart.blocks.find((candidate) => candidate.id === id)
  if (block === undefined) throw new Error('income_statement.missing_block')
  return block
}

/**
 * Converts a contribution "in profit terms" into the number the DRE PRINTS.
 *
 * `effectInView` returns a signed contribution to the profit: revenue adds,
 * expense subtracts. The cascade prints each block in its own reading
 * direction — `(-) Deduções da Receita R$ 5.000,00` shows a positive 5.000
 * under a minus sign (Figma 11:2). Only the report knows the block's
 * `CascadeEffect`, so only the report can do this conversion.
 */
function displayAmount(contribution: Cents, effect: CascadeEffect): Cents {
  return effect === 'Subtract' ? negate(contribution) : contribution
}

/**
 * The default Pago/Previsto toggle for a month.
 *
 * files_design/01 §8.1: a future month only holds Previsto entries (generated by
 * the recurrence engine and by liability instalments), so it opens on Previsto.
 * Takes `currentMonth` as a parameter — the domain never reads a clock.
 */
export function defaultStatusFilterFor(month: Month, currentMonth: Month): EntryStatus {
  return compareMonths(month, currentMonth) > 0 ? 'Planned' : 'Paid'
}

/** The cascade, in order. `null` marks where a subtotal line is printed. */
const CASCADE: readonly (
  keyof typeof BLOCK_IDS | 'netRevenue' | 'ebitda' | 'ebit' | 'netProfit'
)[] = [
  'grossRevenue',
  'revenueDeductions',
  'netRevenue',
  'costOfServices',
  'administrativeExpenses',
  'personalExpenses',
  'ebitda',
  'depreciationAndAmortization',
  'ebit',
  'nonOperatingResult',
  'financialResult',
  'profitTaxes',
  'netProfit',
]

const SUBTOTAL_KEYS = new Set(['netRevenue', 'ebitda', 'ebit', 'netProfit'])

function matchesOnly(entry: Entry, only: IncomeStatementInput['only']): boolean {
  if (only?.recurring && entry.recurrenceId === null) return false
  if (only?.creditCard && !isCardEntry(entry)) return false
  return true
}

/** Despesa, ou receita como um estorno (2026-10-09), marcada "Cartão de crédito". */
function isCardEntry(entry: Entry): boolean {
  return (entry.kind === 'Expense' || entry.kind === 'Revenue') && entry.isCreditCard === true
}

function anyOnly(only: IncomeStatementInput['only']): boolean {
  return only?.recurring === true || only?.creditCard === true
}

export function computeIncomeStatement(input: IncomeStatementInput): IncomeStatement {
  const { entries, chart, view, month, statusFilter } = input
  const forecast = input.forecast === true

  // "A categorizar" fica FORA (decisão do dono, 2026-09-29, PRD v7.47): o que a
  // pessoa ainda não categorizou não é linha de DRE — é Pendência, na Home.
  // Filtrado aqui, uma vez, para que a cascata, a lista "Lançamentos deste
  // mês", a Evolução Mensal e os Indicadores (que chamam esta função) digam a
  // mesma coisa. Consequência aceita: enquanto houver pendência, o DRE não
  // fecha com o extrato do banco.
  const ofMonth = entries.filter(
    (entry) =>
      accountingMonth(entry) === month &&
      !('categoryId' in entry && isUncategorized(entry.categoryId)) &&
      matchesOnly(entry, input.only),
  )

  // Contribution per block, in profit terms. Every block gets a key even when
  // it has no entry, because the screen needs all 13 lines to render its empty
  // state correctly (files_design/01 §15).
  const contributionByBlock = new Map<string, Cents>()
  for (const block of chart.blocks) contributionByBlock.set(block.id, ZERO)
  // DRE expansível (2026-09-23): the same contributions, one level down. Built
  // in THIS loop, from the same `effect`, so a block's breakdown adds up to the
  // block — the filter, the view and the intercompany elimination included.
  const hiddenRows = input.hidden?.rows ?? new Set<string>()
  const hiddenGroups = input.hidden?.groups ?? new Set<string>()
  const isHidden = (entry: Entry) =>
    hiddenRows.has(entry.id) || hiddenGroups.has(breakdownKeyOf(entry))
  // A categoria oculta continua no detalhamento do bloco, fora do total.
  const hiddenByBlock = new Map<string, Map<string, { label: string; contribution: Cents }>>()
  const addHidden = (blockId: string, key: string, label: string, contribution: Cents) => {
    const items = hiddenByBlock.get(blockId) ?? new Map()
    const current = items.get(key)
    items.set(key, { label, contribution: add(current?.contribution ?? ZERO, contribution) })
    hiddenByBlock.set(blockId, items)
  }
  // O valor CHEIO de cada item, sem a simulação: só ordena. "Não precisa
  // reordenar, só recalcular" (dono, 2026-10-01) — ocultar muda o valor, nunca
  // a posição da linha.
  const fullByBlock = new Map<string, Map<string, { label: string; contribution: Cents }>>()
  const addFull = (blockId: string, key: string, label: string, contribution: Cents) => {
    const items = fullByBlock.get(blockId) ?? new Map()
    const current = items.get(key)
    items.set(key, { label, contribution: add(current?.contribution ?? ZERO, contribution) })
    fullByBlock.set(blockId, items)
  }
  const breakdownByBlock = new Map<string, Map<string, { label: string; contribution: Cents }>>()
  const addToBreakdown = (blockId: string, key: string, label: string, contribution: Cents) => {
    const items = breakdownByBlock.get(blockId) ?? new Map()
    const current = items.get(key)
    items.set(key, { label, contribution: add(current?.contribution ?? ZERO, contribution) })
    breakdownByBlock.set(blockId, items)
  }

  for (const entry of ofMonth) {
    if (!forecast && !entersIncomeStatement(entry, statusFilter)) continue
    const effect = effectInView(entry, view)
    if (effect.kind !== 'Included') continue
    const block = blockForRole(effect.role, entry, chart)
    addFull(block.id, breakdownKeyOf(entry), breakdownLabelOf(entry, chart), effect.contribution)
    if (hiddenGroups.has(breakdownKeyOf(entry))) {
      addHidden(
        block.id,
        breakdownKeyOf(entry),
        breakdownLabelOf(entry, chart),
        effect.contribution,
      )
      continue
    }
    if (hiddenRows.has(entry.id)) continue
    contributionByBlock.set(
      block.id,
      add(contributionByBlock.get(block.id) ?? ZERO, effect.contribution),
    )
    addToBreakdown(
      block.id,
      breakdownKeyOf(entry),
      breakdownLabelOf(entry, chart),
      effect.contribution,
    )
  }

  // P6 — a parcela de Passivo entra no bloco 4 pelo valor cheio.
  //
  // O filtro Pago/Previsto vale para a CASCATA e não para as linhas: o card
  // "Lançamentos deste mês" mostra "pagos e previstos juntos, independente do
  // filtro da cascata" (Figma 11:2, legenda do card), e é por isso que
  // `buildRows` também recebe o mês inteiro, sem filtrar por status.
  const parcelas = statementInstallments(input, month)
  const bloco = BLOCK_IDS.administrativeExpenses
  for (const p of parcelas) {
    if (!forecast && statusFilter === 'Paid' && p.status !== 'Paid') continue
    addFull(bloco, `liability:${p.liabilityId}`, p.liabilityName, negate(p.amount))
    if (hiddenGroups.has(`liability:${p.liabilityId}`)) {
      addHidden(bloco, `liability:${p.liabilityId}`, p.liabilityName, negate(p.amount))
      continue
    }
    if (hiddenRows.has(p.installmentId)) continue
    contributionByBlock.set(bloco, add(contributionByBlock.get(bloco) ?? ZERO, negate(p.amount)))
    addToBreakdown(bloco, `liability:${p.liabilityId}`, p.liabilityName, negate(p.amount))
  }

  const contributionOf = (key: keyof typeof BLOCK_IDS): Cents =>
    contributionByBlock.get(BLOCK_IDS[key]) ?? ZERO

  // The subtotals sum contributions, not printed amounts — profit terms add up
  // directly, which is the whole reason for that convention.
  const netRevenue = add(contributionOf('grossRevenue'), contributionOf('revenueDeductions'))
  // P44: o Lucro Bruto de verdade desconta o CSV. Não vira linha da cascata (o
  // produto fechou em 13), mas o `grossMargin` lê daqui.
  const grossProfit = add(netRevenue, contributionOf('costOfServices'))
  const ebitda = add(
    grossProfit,
    contributionOf('administrativeExpenses'),
    contributionOf('personalExpenses'),
  )
  // PRD §5 and a release criterion: D&A is always zero in the MVP, so
  // EBITDA === EBIT every month. Both lines are kept for fidelity to the
  // reference structure; the equality is asserted by a test, not assumed.
  const ebit = add(ebitda, contributionOf('depreciationAndAmortization'))
  const netProfit = add(
    ebit,
    contributionOf('nonOperatingResult'),
    contributionOf('financialResult'),
    contributionOf('profitTaxes'),
  )

  const subtotals = { netRevenue, ebitda, ebit, netProfit }

  const lines: StatementLine[] = CASCADE.map((key) => {
    if (SUBTOTAL_KEYS.has(key)) {
      const subtotalKey = key as keyof typeof subtotals
      return {
        kind: 'subtotal',
        key: subtotalKey,
        label: LABEL_STATEMENT_SUBTOTAL[subtotalKey],
        amount: subtotals[subtotalKey],
        level: 0,
      }
    }
    const blockKey = key as keyof typeof BLOCK_IDS
    const block = requireBlock(chart, BLOCK_IDS[blockKey])
    return {
      kind: 'block',
      key: block.id,
      label: block.statementLabel ?? block.name,
      amount: displayAmount(contributionOf(blockKey), block.effect),
      level: 0,
      // Na ordem do valor cheio, maior primeiro. O valor mostrado é o
      // recalculado; a categoria oculta inteira mostra o que teria, marcada.
      breakdown: [...(fullByBlock.get(block.id)?.entries() ?? [])]
        .filter(([, full]) => full.contribution !== 0)
        .sort(([, x], [, y]) => Math.abs(y.contribution) - Math.abs(x.contribution))
        .map(([itemKey, full]) => {
          const hiddenGroup = hiddenByBlock.get(block.id)?.get(itemKey)
          if (hiddenGroup !== undefined) {
            return {
              key: itemKey,
              label: full.label,
              amount: displayAmount(hiddenGroup.contribution, block.effect),
              hidden: true,
            }
          }
          const visible = breakdownByBlock.get(block.id)?.get(itemKey)?.contribution ?? ZERO
          return { key: itemKey, label: full.label, amount: displayAmount(visible, block.effect) }
        }),
    }
  })

  return {
    month,
    view,
    statusFilter,
    forecast,
    lines,
    grossProfit,
    netProfit,
    rows: [
      ...buildRows(ofMonth, chart, view, isHidden),
      ...installmentRows(
        parcelas,
        chart,
        (p) => hiddenRows.has(p.installmentId) || hiddenGroups.has(`liability:${p.liabilityId}`),
      ),
    ],
  }
}

/**
 * The "Lançamentos deste mês" table under the cascade.
 *
 * files_design/01 §8.1: it is ALWAYS visible, shows Pago and Previsto TOGETHER,
 * and has no filter of its own — the filter lives only in the cascade's toggle.
 * So this deliberately ignores `statusFilter`.
 */
function buildRows(
  entriesOfMonth: readonly Entry[],
  chart: ChartOfAccounts,
  view: View,
  isHidden: (entry: Entry) => boolean,
): IncomeStatementRow[] {
  const rows: IncomeStatementRow[] = []
  for (const entry of entriesOfMonth) {
    const effect = effectInView(entry, view)
    if (effect.kind !== 'Included') continue
    const block = blockForRole(effect.role, entry, chart)
    rows.push({
      source: sourceOf(entry),
      name: nameOf(entry, chart),
      entity: entityOf(entry, view),
      // `null` for pró-labore/distribuição, the two roles that carry no
      // Categoria at all (see `blockForRole` above).
      categoryId: 'categoryId' in entry ? entry.categoryId : null,
      blockId: block.id,
      blockName: block.name,
      status: entry.status,
      amount: displayAmount(effect.contribution, block.effect),
      ...(entry.description ? { description: entry.description } : {}),
      ...(entry.recurrenceId !== null ? { recurring: true } : {}),
      ...(isCardEntry(entry) ? { isCreditCard: true } : {}),
      date: entry.date,
      ...(isHidden(entry) ? { hidden: true } : {}),
      flow: flowOf(entry, view),
    })
  }
  return rows
}

/**
 * Where the row came from. Today only Lançamentos reach the sheet; the
 * `Installment` variant exists because a liability instalment is a Previsto
 * item of the month too (files_design/01 §6), and it will be folded in when the
 * liability module feeds the statement.
 */
function sourceOf(entry: Entry): IncomeStatementRow['source'] {
  return { kind: 'Entry', entryId: entry.id }
}

/**
 * files_design/07 "Hierarquia de cor": the row's PF/PJ etiqueta.
 *
 * Despesa, Receita and IR carry their own `entity`. Pró-labore and Distribuição
 * de Lucro do not (`src/domain/entries/types.ts`: "No entity field — the
 * intercompany engine derives the [entity]") because the SAME entry reads as PF
 * revenue or as PJ expense depending on which side is looking — exactly what
 * `effectInView` above just decided. This function is only reached after that
 * call returned `Included`, and for these two kinds that only happens when
 * `view` is 'PF' or 'PJ' (never 'Consolidated', which always eliminates them) —
 * so the view IS the entity the row is being read as.
 */
function entityOf(entry: Entry, view: View): Entity {
  if (entry.kind === 'ProLabore' || entry.kind === 'ProfitDistribution') {
    if (view === 'Consolidated') {
      throw new Error('unreachable: Consolidated eliminates ProLabore/ProfitDistribution')
    }
    return view
  }
  return entry.entity
}

/**
 * What the row is called. It is derived, never a field: files_design/03 says
 * "a Categoria já identifica o lançamento", which is exactly why Despesa and
 * Receita have no Rótulo and IR does.
 */
/** The breakdown groups by category; what has no category groups by its kind. */
function breakdownKeyOf(entry: Entry): string {
  return entry.kind === 'Expense' || entry.kind === 'Revenue'
    ? `category:${entry.categoryId}`
    : `kind:${entry.kind}`
}

/** Like `nameOf`, except IR is one group, not one per Rótulo. */
function breakdownLabelOf(entry: Entry, chart: ChartOfAccounts): string {
  return entry.kind === 'IncomeTax' ? 'IR' : nameOf(entry, chart)
}

function nameOf(entry: Entry, chart: ChartOfAccounts): string {
  switch (entry.kind) {
    case 'Expense':
    case 'Revenue': {
      const category = chart.categories.find((candidate) => candidate.id === entry.categoryId)
      return category?.name ?? 'Categoria removida'
    }
    case 'ProLabore':
      return 'Pró-labore'
    case 'ProfitDistribution':
      return 'Distribuição de lucro'
    case 'IncomeTax':
      return entry.label ?? 'IR'
  }
}

/**
 * Whether the "Destinar este Lucro" card is offered.
 *
 * files_design/01 §8.1 and §9: with a loss, the card disappears and becomes an
 * informative message. Figma `242:14` (Wireframe, frame `242:2`) states the
 * criterion behind it — «não faz sentido oferecer alocação de algo que não
 * existe» — which is why zero is refused too: at zero there is no value that
 * exists to allocate. Same threshold as `canAllocate`.
 */
export function hasProfitToAllocate(statement: IncomeStatement): boolean {
  return !isNegative(statement.netProfit) && statement.netProfit !== ZERO
}

/* -------------------------------------------------------------------------
 * P6 — parcela de Passivo no DRE (produto, 2026-09-08)
 * ---------------------------------------------------------------------- */

interface StatementInstallment {
  readonly installmentId: Installment['id']
  readonly liabilityId: Liability['id']
  readonly name: string
  /** The Passivo alone, without "parcela N" — what the DRE breakdown groups by. */
  readonly liabilityName: string
  readonly entity: Entity
  readonly amount: Cents
  readonly status: EntryStatus
}

/**
 * As parcelas que entram no DRE deste mês, já filtradas por mês, status e visão.
 *
 * O mês contábil é o da data de PAGAMENTO quando ela existe, e o da prevista
 * enquanto a parcela é Prevista — é a mesma regra de caixa que
 * `accountingMonth` aplica a um Lançamento (PRD §5). Uma parcela prevista para
 * 10/08 e paga em 02/09 é despesa de setembro.
 *
 * Parcela descartada não entra: "Descartar" pula ESTA ocorrência (Figma 34:2 nó
 * 34:36), e pular significa que ela não aconteceu neste mês.
 */
function statementInstallments(
  input: IncomeStatementInput,
  targetMonth: Month,
): readonly StatementInstallment[] {
  const { liabilities = [], installments = [], view } = input
  if (installments.length === 0 || anyOnly(input.only)) return []

  const byId = new Map(liabilities.map((l) => [l.id, l]))
  const out: StatementInstallment[] = []

  for (const parcela of installments) {
    if (parcela.discarded) continue
    const liability = byId.get(parcela.liabilityId)
    if (liability === undefined) continue
    if (!(view === 'Consolidated' || view === liability.entity)) continue

    const date =
      parcela.status === 'Paid' ? (parcela.paidDate ?? parcela.plannedDate) : parcela.plannedDate
    if (monthOf(date) !== targetMonth) continue

    out.push({
      installmentId: parcela.id,
      liabilityId: liability.id,
      // Figma 11:2 nó 235:64: "Financiamento apartamento, parcela 13".
      name: `${liability.name}, parcela ${parcela.number}`,
      liabilityName: liability.name,
      entity: liability.entity,
      amount:
        parcela.status === 'Paid'
          ? (parcela.paidAmount ?? parcela.plannedAmount)
          : parcela.plannedAmount,
      status: parcela.status,
    })
  }
  return out
}

/** A linha de "Lançamentos deste mês" que o Figma 11:2 desenha para a parcela. */
function installmentRows(
  parcelas: readonly StatementInstallment[],
  chart: ChartOfAccounts,
  isHidden: (p: StatementInstallment) => boolean,
): IncomeStatementRow[] {
  if (parcelas.length === 0) return []
  const block = requireBlock(chart, BLOCK_IDS.administrativeExpenses)
  return parcelas.map((p) => ({
    source: { kind: 'Installment', installmentId: p.installmentId, liabilityId: p.liabilityId },
    name: p.name,
    entity: p.entity,
    // A parcela não tem Categoria: ela não é um Lançamento, é uma linha do
    // cronograma do Passivo. O bloco é o que o P6 decidiu.
    categoryId: null,
    blockId: block.id,
    blockName: block.name,
    status: p.status,
    amount: p.amount,
    ...(isHidden(p) ? { hidden: true } : {}),
    // A parcela sai do caixa e entra no bloco 4 negativa (P6).
    flow: 'Out' as const,
  }))
}

/**
 * Entrada ou saída de um lançamento nesta visão, pelo SINAL do efeito no lucro
 * — a mesma regra da cascata. Medido com valor unitário, para que um mês "a
 * definir" ainda em branco (valor zero) tenha a direção que vai ter.
 */
function flowOf(entry: Entry, view: View): 'In' | 'Out' {
  const effect = effectInView({ ...entry, amount: cents(1) } as Entry, view)
  return effect.kind === 'Included' && effect.contribution > 0 ? 'In' : 'Out'
}

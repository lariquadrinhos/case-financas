'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardBody, CardHeader, CardTitle, CardCaption } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Empty } from '@/components/patterns/empty'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { formatMoney, type Cents, type Month, type View } from '@/domain/core'
import { defaultStatusFilterFor } from '@/domain/reports'
import { apiGet } from '@/lib/api-client'
import { todayMonth } from '@/lib/today'
import { isOthersBlock, prepareTreemapItems } from '@/lib/treemap'
import type { TreemapItem } from '@/lib/treemap'
import { MonthViewToolbar } from './month-view-toolbar'
import { groupByName, splitFlowRows } from '../_lib/cash-flow'
import { useCashFlow } from '../_lib/queries'
import { FlowDetailModal, type FlowSelection } from './modals/flow-detail-modal'

interface StatementBlock {
  id: string
  effect: 'Add' | 'Subtract' | 'Signed' | 'None'
}

function useBlockEffects() {
  return useQuery({
    queryKey: ['statement-blocks'],
    queryFn: () => apiGet<{ data: StatementBlock[] }>('/statement-blocks'),
    staleTime: Infinity, // the 10 blocks are fixed (files_design/01 §3.1)
    select: (response) => new Map(response.data.map((block) => [block.id, block.effect])),
  })
}

/**
 * Entradas e Saídas — files_design/08 §5. No dedicated report exists for this
 * screen (docs/PERGUNTAS-EM-ABERTO): it is rendered from the SAME
 * `income-statement` numbers the DRE shows, re-read as "money in" (blocks
 * with cascade effect `Add`, plus a positive `Signed` block) versus "money
 * out" (`Subtract` blocks, plus a negative `Signed` block) — never a second,
 * parallel computation. "Sobrou" is the statement's own `netProfit`, which is
 * mathematically the difference between those two totals by construction, so
 * the PRD's invariant ("entradas = saídas + Sobrou") holds without being
 * asserted separately.
 */
export function CashFlowCard({
  month,
  view,
  onMonthChange,
  onViewChange,
}: {
  month: Month
  view: View
  onMonthChange: (month: Month) => void
  onViewChange: (view: View) => void
}) {
  // "Pago em mês atual/passado; Previsto em mês futuro" (files_design/03, DRE;
  // PRD v7 reversão (A) estende a regra a Entradas e Saídas). É exatamente o
  // que a legenda do card promete — pedir sempre `Paid` deixava todo mês
  // futuro zerado, sem a projeção prometida.
  const [currentMonth] = React.useState(todayMonth)
  const statusFilter = defaultStatusFilterFor(month, currentMonth)

  const blocks = useBlockEffects()
  const statement = useCashFlow(month, view, statusFilter)
  const [selection, setSelection] = React.useState<FlowSelection | null>(null)

  const { inflows, outflows, inflowRows, outflowRows, leftover } = React.useMemo(() => {
    if (!blocks.data || !statement.data) {
      return { inflows: [], outflows: [], inflowRows: [], outflowRows: [], leftover: null }
    }
    // O recorte por status vive em `_lib/cash-flow.ts` porque é a regra que
    // mantém as duas metades do card coerentes (files_design/08 §5.2), e regra
    // testável não fica presa dentro de um componente.
    const { inflows: inflowRows, outflows: outflowRows } = splitFlowRows(
      statement.data.rows,
      blocks.data,
      statement.data.statusFilter,
    )
    return {
      inflows: prepareTreemapItems(groupByName(inflowRows), 'Outros'),
      outflows: prepareTreemapItems(groupByName(outflowRows), 'Outros'),
      inflowRows,
      outflowRows,
      leftover: statement.data.netProfit as Cents,
    }
  }, [blocks.data, statement.data])

  // Detalhe do Fluxo (files_design/01 §13): "os lançamentos que compõem
  // aquele valor" — o "Outras" agregado abre a soma de tudo que não ganhou
  // bloco próprio, nunca um bloco vazio (files_design/08 §2.7).
  function openDetail(
    item: TreemapItem,
    items: readonly TreemapItem[],
    rows: readonly { name: string; amount: Cents }[],
  ) {
    const rowsForItem = isOthersBlock(item.id)
      ? rows.filter(
          (row) => !items.some((visible) => visible.id !== item.id && visible.name === row.name),
        )
      : rows.filter((row) => row.name === item.name)
    setSelection({ name: item.name, total: item.value, rows: rowsForItem })
  }

  const loading = blocks.isPending || statement.isPending
  const empty = !loading && inflows.length === 0 && outflows.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entradas e Saídas</CardTitle>
        <CardCaption>
          De onde vem e pra onde vai o dinheiro no mês selecionado. Mês atual ou passado mostra
          fato; mês futuro mostra projeção.
        </CardCaption>
      </CardHeader>
      <CardBody className="flex flex-col gap-20">
        <MonthViewToolbar
          month={month}
          view={view}
          onMonthChange={onMonthChange}
          onViewChange={onViewChange}
        />
        {loading ? (
          <Loading bars={SKELETON_BARS.MAPA_DE_FLUXO} />
        ) : empty ? (
          // Frame 310:2 ("Vazio — Home") desenha o botão "+ Novo Lançamento"
          // neste estado vazio — sem `actionHref` o <Empty> o omite.
          <Empty copy={EMPTY_STATES.MAPA_DE_FLUXO} actionHref="/novo-lancamento" />
        ) : (
          <div className="grid grid-cols-1 gap-24 md:grid-cols-2">
            <FlowColumn
              title="Entradas"
              items={inflows}
              onSelect={(item) => openDetail(item, inflows, inflowRows)}
            />
            <FlowColumn
              title="Saídas"
              items={outflows}
              footer={leftover}
              onSelect={(item) => openDetail(item, outflows, outflowRows)}
            />
          </div>
        )}
      </CardBody>
      <FlowDetailModal
        selection={selection}
        open={selection !== null}
        onOpenChange={(next) => {
          if (!next) setSelection(null)
        }}
      />
    </Card>
  )
}

function FlowColumn({
  title,
  items,
  footer,
  onSelect,
}: {
  title: string
  items: readonly TreemapItem[]
  footer?: Cents | null
  onSelect: (item: TreemapItem) => void
}) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>{title}</TableHeader>
          <TableHeader numeric>Valor</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} interactive onClick={() => onSelect(item)}>
            <TableCell>{item.name}</TableCell>
            <TableCell numeric>{formatMoney(item.value)}</TableCell>
          </TableRow>
        ))}
        {footer !== undefined && footer !== null ? (
          <TableRow>
            <TableCell className="font-medium text-ink-primary">Sobrou</TableCell>
            <TableCell numeric className="font-medium">
              {formatMoney(footer)}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  )
}

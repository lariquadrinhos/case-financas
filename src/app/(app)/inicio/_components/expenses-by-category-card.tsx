'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardCaption,
  CardLinkIcon,
} from '@/components/ui/card'
import { Treemap } from '@/components/patterns/treemap'
import { isOthersBlock, prepareTreemapItems, type TreemapItem } from '@/lib/treemap'
import { Empty } from '@/components/patterns/empty'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { ZERO, add, type Cents, type Month } from '@/domain/core'
import { useCategories, useDiscretionarySpendingConfig, useMonthlyExpenses } from '../_lib/queries'
import type { Category } from '../_lib/queries'
import { CategoryDetailModal } from './modals/category-detail-modal'
import { FlowDetailModal, type FlowSelection } from './modals/flow-detail-modal'
import { DiscretionaryDetailModal } from './modals/discretionary-detail-modal'
import { isConsumoLivreCategory } from '../_lib/category-routing'

// files_design/08 §2.3: altura fixa de 210px; a largura "acompanha o card" e é
// medida pelo próprio <Treemap>.
const CARD_HEIGHT = 210

/**
 * Despesas por Categoria — files_design/01 §4, files_design/08 §2. Grouped
 * client-side from the same `/entries` list the Histórico screen reads
 * (Lançamentos de Despesa, pagos, do mês) — there is no dedicated
 * aggregation endpoint, and this is exactly the kind of grouping a screen is
 * expected to do over a real resource list, not a parallel computation.
 */
export function ExpensesByCategoryCard({ month }: { month: Month }) {
  const categories = useCategories()
  const expenses = useMonthlyExpenses(month)
  const discretionaryConfig = useDiscretionarySpendingConfig()
  const [selectedCategory, setSelectedCategory] = React.useState<Category | null>(null)
  const [discretionaryOpen, setDiscretionaryOpen] = React.useState(false)
  const [othersSelection, setOthersSelection] = React.useState<FlowSelection | null>(null)

  const items = React.useMemo(() => {
    if (!categories.data || !expenses.data) return []
    const categoryName = new Map(categories.data.data.map((c) => [c.id, c.name]))
    const totals = new Map<string, Cents>()
    for (const entry of expenses.data.data) {
      if (entry.kind !== 'Expense') continue
      totals.set(entry.categoryId, add(totals.get(entry.categoryId) ?? ZERO, entry.amount as Cents))
    }
    return [...totals.entries()].map(([categoryId, value]) => ({
      id: categoryId,
      name: categoryName.get(categoryId) ?? 'Categoria removida',
      value,
    }))
  }, [categories.data, expenses.data])

  // files_design/08 §2.7: da sétima categoria em diante tudo vira um bloco
  // "Outras". O <Treemap> agrega sozinho pra desenhar; aqui a mesma conta é
  // refeita pra saber O QUE ele agregou, que é o conteúdo do detalhe.
  const othersRows = React.useMemo(() => {
    const visible = new Set(prepareTreemapItems(items).map((item) => item.id))
    return items
      .filter((item) => !visible.has(item.id))
      .sort((a, b) => b.value - a.value)
      .map((item) => ({ name: item.name, amount: item.value }))
  }, [items])

  const loading = categories.isPending || expenses.isPending

  // "Clicar num bloco abre o detalhe da categoria ... exceto Consumo Livre,
  // que abre seu próprio painel, nunca um formulário" (files_design/01 §4).
  function handleSelect(item: TreemapItem) {
    // "Outras" não é categoria nenhuma: procurar o id dela na lista de
    // categorias devolvia null e o clique não abria NADA — o bloco existia na
    // tela e não respondia. O detalhe dele é a soma que ele representa,
    // exatamente como no card irmão de Entradas e Saídas (files_design/08 §2.7,
    // "nunca um bloco vazio").
    if (isOthersBlock(item.id)) {
      setOthersSelection({ name: item.name, total: item.value, rows: othersRows })
      return
    }
    const category = categories.data?.data.find((c) => c.id === item.id) ?? null
    if (category && isConsumoLivreCategory(category)) {
      setDiscretionaryOpen(true)
      return
    }
    setSelectedCategory(category)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex flex-col gap-4">
          <CardTitle>Despesas por Categoria</CardTitle>
          <CardCaption>Clique na categoria para visualizar ou adicionar gastos.</CardCaption>
        </div>
        {/* files_design/08 §2.9: separate action from the blocks — opens Histórico
            filtered by this month, the "visão ampla" the card icon stands for. */}
        <Link
          href={`/historico?mes=${month}`}
          aria-label="Ver Histórico deste mês"
          className="shrink-0"
        >
          <CardLinkIcon />
        </Link>
      </CardHeader>
      <CardBody>
        {loading ? (
          <Loading bars={SKELETON_BARS.DESPESAS_POR_CATEGORIA} />
        ) : items.length === 0 ? (
          <Empty copy={EMPTY_STATES.DESPESAS_POR_CATEGORIA} actionHref="/novo-lancamento" />
        ) : (
          <Treemap items={items} height={CARD_HEIGHT} variant="filled" onSelect={handleSelect} />
        )}
      </CardBody>
      <FlowDetailModal
        selection={othersSelection}
        open={othersSelection !== null}
        onOpenChange={(next) => {
          if (!next) setOthersSelection(null)
        }}
        backLabel="Despesas por Categoria"
        footnote="Só consulta — pra lançar um gasto numa destas categorias, use Novo Lançamento."
      />
      <CategoryDetailModal
        category={selectedCategory}
        month={month}
        open={selectedCategory !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedCategory(null)
        }}
      />
      {discretionaryConfig.data ? (
        <DiscretionaryDetailModal
          open={discretionaryOpen}
          onOpenChange={setDiscretionaryOpen}
          month={month}
          config={discretionaryConfig.data}
        />
      ) : null}
    </Card>
  )
}

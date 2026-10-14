'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LABEL_CLASSIFICATION, LABEL_ENTITY, LABEL_STATUS } from '@/domain/core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FilterSelect } from '@/components/patterns/filter-select'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import {
  useBankAccounts,
  useCategoriesIncludingArchived,
} from '@/features/novo-lancamento/use-novo-lancamento'
import { useHistoricoEntries } from '@/features/historico/use-historico'
import { LinkToBankButton } from '@/features/open-finance/link-to-bank-button'
import { DiscardEntryButton } from '@/features/novo-lancamento/discard-entry-button'
import { RecurringMark } from '@/components/patterns/recurring-mark'
import { CreditCardMark } from '@/components/patterns/credit-card-mark'
import {
  entryDisplayName,
  entrySignedAmount,
  formatSignedMoney,
} from '@/features/historico/entry-display'
import {
  EMPTY_HISTORICO_FILTERS,
  type Entry,
  type HistoricoFilters,
} from '@/features/historico/types'
import {
  UNCATEGORIZED_EXPENSE_CATEGORY_ID,
  UNCATEGORIZED_REVENUE_CATEGORY_ID,
} from '@/domain/chart-of-accounts'

const STATUS_OPTIONS = [
  { value: '', label: 'Status: todos' },
  { value: 'Planned', label: 'Previsto' },
  { value: 'Paid', label: 'Pago' },
]

const VIEW_OPTIONS = [
  { value: '', label: 'Entidade: todas' },
  { value: 'PF', label: 'PF' },
  { value: 'PJ', label: 'PJ' },
  { value: 'Consolidated', label: 'Consolidado' },
]

const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'Classificação: todas' },
  { value: 'Current', label: LABEL_CLASSIFICATION.Current },
  { value: 'NonCurrent', label: LABEL_CLASSIFICATION.NonCurrent },
]

const RECURRING_OPTIONS = [
  { value: '', label: 'Recorrência: todas' },
  { value: 'true', label: 'Recorrente' },
  { value: 'false', label: 'Não recorrente' },
]

/** "Data de pagamento"/"Data do recebimento" as dd/mm — Histórico shows one column for every kind. */
function formatShortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function accountLabel(entry: Entry, accountsById: ReadonlyMap<string, { label: string }>): string {
  if (entry.kind === 'ProLabore' || entry.kind === 'ProfitDistribution') {
    // ADR-0018: sem origem, o mesmo '—' de uma conta que não se encontra.
    const source =
      entry.sourceAccountId === null ? '—' : (accountsById.get(entry.sourceAccountId)?.label ?? '—')
    const destination = accountsById.get(entry.destinationAccountId)?.label ?? '—'
    return `${source} → ${destination}`
  }
  return accountsById.get(entry.bankAccountId)?.label ?? '—'
}

export default function HistoricoPage() {
  const router = useRouter()
  const [filters, setFilters] = React.useState<HistoricoFilters>(EMPTY_HISTORICO_FILTERS)

  const entriesQuery = useHistoricoEntries(filters)
  // Inclui arquivadas: este filtro olha para trás, e lançamento de categoria
  // descartada continua contando no DRE. Ver o comentário do hook.
  const categoriesQuery = useCategoriesIncludingArchived()
  const accountsQuery = useBankAccounts()

  const categories = React.useMemo(() => categoriesQuery.data?.data ?? [], [categoriesQuery.data])
  const accounts = React.useMemo(() => accountsQuery.data?.data ?? [], [accountsQuery.data])
  const categoriesById = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const accountsById = React.useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const entries = entriesQuery.data?.data ?? []
  const hasActiveFilters = Object.values(filters).some((value) => value !== '')

  function updateFilter<K extends keyof HistoricoFilters>(key: K, value: HistoricoFilters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-4">
        <h1 className="text-style-heading-xl text-ink-primary">Histórico</h1>
        <p className="text-style-body-sm text-ink-secondary">
          Histórico: todos os lançamentos já registrados, de qualquer tipo.
        </p>
        <p className="text-style-body-sm text-ink-secondary">
          Use os filtros pra encontrar rapidamente o que precisa.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => updateFilter('status', value as HistoricoFilters['status'])}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label="Entidade"
          value={filters.view}
          onChange={(value) => updateFilter('view', value as HistoricoFilters['view'])}
          options={VIEW_OPTIONS}
        />
        <label className="flex flex-col gap-4">
          <span className="sr-only">Mês</span>
          <input
            aria-label="Mês"
            type="month"
            lang="pt-BR"
            value={filters.month}
            onChange={(event) => updateFilter('month', event.target.value)}
            className="h-[var(--height-control)] rounded-control border border-line-control bg-surface-card px-8 text-style-body-sm text-ink-primary"
          />
        </label>
        <FilterSelect
          label="Categoria"
          value={filters.categoryId}
          onChange={(value) => updateFilter('categoryId', value)}
          options={[
            { value: '', label: 'Categoria: todas' },
            // As duas "A categorizar" (PRD v7.46) têm o mesmo nome e apareciam
            // iguais, lado a lado, neste filtro — onde elas servem justamente
            // para achar o que falta categorizar.
            ...categories.map((c) => ({
              value: c.id,
              label:
                c.id === UNCATEGORIZED_EXPENSE_CATEGORY_ID
                  ? 'A categorizar (despesa)'
                  : c.id === UNCATEGORIZED_REVENUE_CATEGORY_ID
                    ? 'A categorizar (receita)'
                    : c.name,
            })),
          ]}
        />
        <FilterSelect
          label="Classificação"
          value={filters.classification}
          onChange={(value) =>
            updateFilter('classification', value as HistoricoFilters['classification'])
          }
          options={CLASSIFICATION_OPTIONS}
        />
        <FilterSelect
          label="Conta"
          value={filters.bankAccountId}
          onChange={(value) => updateFilter('bankAccountId', value)}
          options={[
            { value: '', label: 'Conta: todas' },
            ...accounts.map((a) => ({ value: a.id, label: a.label })),
          ]}
        />
        <FilterSelect
          label="Recorrência"
          value={filters.recurring}
          onChange={(value) => updateFilter('recurring', value as HistoricoFilters['recurring'])}
          options={RECURRING_OPTIONS}
        />
        {hasActiveFilters ? (
          <Button
            variant="secondary"
            size="compact"
            onClick={() => setFilters(EMPTY_HISTORICO_FILTERS)}
          >
            Limpar filtros
          </Button>
        ) : null}
      </div>

      <Card className="p-8">
        {entriesQuery.isLoading ? (
          <Loading label="Carregando Histórico" bars={SKELETON_BARS.HISTORICO} />
        ) : entries.length === 0 ? (
          <Empty copy={EMPTY_STATES.HISTORICO} actionHref="/novo-lancamento?from=historico" />
        ) : (
          <Table maxRows={10}>
            <TableHead sticky>
              <TableRow>
                <TableHeader>Data</TableHeader>
                <TableHeader>Lançamento</TableHeader>
                <TableHeader>Entidade</TableHeader>
                <TableHeader>Conta</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader numeric>Valor</TableHeader>
                <TableHeader>
                  <span className="sr-only">Ações</span>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => {
                const signedAmount = entrySignedAmount(entry)
                const rowContent = (
                  <>
                    <TableCell>{formatShortDate(entry.date)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-8">
                        {entryDisplayName(entry, categoriesById)}
                        {entry.recurrenceId !== null ? <RecurringMark /> : null}
                        {(entry.kind === 'Expense' || entry.kind === 'Revenue') &&
                        entry.isCreditCard ? (
                          <CreditCardMark />
                        ) : null}
                      </span>
                      {/* A Descrição (2026-09-29), quando o lançamento tem uma. */}
                      {entry.description ? (
                        <span className="block truncate text-style-body-sm text-ink-secondary">
                          {entry.description}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {entry.kind === 'ProLabore' || entry.kind === 'ProfitDistribution' ? (
                        <span className="text-style-body-sm text-ink-tertiary">—</span>
                      ) : (
                        <Badge tone={entry.entity === 'PF' ? 'pf' : 'pj'}>
                          {LABEL_ENTITY[entry.entity]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{accountLabel(entry, accountsById)}</TableCell>
                    <TableCell>
                      {entry.status === 'Planned' ? (
                        <Badge tone="previsto">Previsto</Badge>
                      ) : (
                        <span className="text-style-body-sm text-ink-tertiary">
                          {LABEL_STATUS[entry.kind].Paid}
                        </span>
                      )}
                    </TableCell>
                    <TableCell numeric>{formatSignedMoney(signedAmount)}</TableCell>
                    <TableCell>
                      {/* A linha inteira abre a edição; as ações não podem
                          disparar isso — nem o clique no botão, nem os cliques
                          dentro do diálogo, que sobem pela árvore do React
                          mesmo estando num portal. */}
                      <span
                        className="flex justify-end gap-8"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {/* Feito à mão: liga à transação do banco (dono, 2026-10-09). */}
                        {entry.linkedToBank !== true &&
                        (entry.kind === 'Expense' ||
                          entry.kind === 'Revenue' ||
                          entry.kind === 'IncomeTax') ? (
                          <LinkToBankButton
                            entryId={entry.id}
                            entryName={entryDisplayName(entry, categoriesById)}
                          />
                        ) : null}
                        <DiscardEntryButton
                          entryId={entry.id}
                          entryName={entryDisplayName(entry, categoriesById)}
                          hasRecurrence={entry.recurrenceId !== null}
                        />
                      </span>
                    </TableCell>
                  </>
                )

                // Toda linha abre a edição, Consumo Livre inclusive (PRD v7.66):
                // a linha que não abria era o bloqueio antigo.
                const href = `/novo-lancamento?from=historico&entryId=${encodeURIComponent(entry.id)}`
                return (
                  // `interactive` is the sanctioned clickable row of
                  // `components/ui/table` (tabIndex + Enter/Espaço + the
                  // doc07 `table-row/focus` ring). No `role="link"`: it would
                  // replace the row's implicit `row` role and strip every
                  // cell of its row/column relationship, which is the one
                  // thing a real `<table>` was chosen for.
                  <TableRow key={entry.id} interactive onClick={() => router.push(href)}>
                    {rowContent}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {entries.length > 0 ? (
        <Button asChild variant="secondary" className="self-end">
          <Link href="/novo-lancamento?from=historico">+ Adicionar</Link>
        </Button>
      ) : null}
    </div>
  )
}

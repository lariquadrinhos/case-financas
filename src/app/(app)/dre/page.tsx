'use client'

/**
 * DRE — files_design/01 §8.1, Figma 11:2.
 *
 * A read-only projection over `/api/v1/reports/income-statement`
 * (`src/api/contracts/reports.ts`): this screen never computes a cascade of
 * its own, it only asks the report for one month/view/status and renders
 * exactly the `lines`/`rows` it gets back.
 */

import * as React from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type Cents,
  type EntryId,
  type EntryStatus,
  type InstallmentId,
  type LiabilityId,
  type Month,
  formatMoney,
  isNegative,
  negate,
} from '@/domain/core'
import type { IncomeStatement, IncomeStatementRow } from '@/domain/reports'
import { defaultStatusFilterFor } from '@/domain/reports'
import { entersIncomeStatement } from '@/domain/entries'
import { operatorFor } from '@/lib/dre-cascade'
import { todayMonth } from '@/lib/today'
import { fetchIncomeStatement } from '@/lib/reports-client'
import { useReportView } from '@/lib/use-report-view'
import { ViewSwitch } from '@/components/patterns/view-switch'
import { StatusSwitch } from '@/components/patterns/status-switch'
import { MonthNav } from '@/components/patterns/month-nav'
import { MarkAsPaidDialog } from '@/components/patterns/mark-as-paid-dialog'
import { MarkInstallmentPaidDialog } from '@/components/patterns/mark-installment-paid-dialog'
import { MarkOccurrencePaidDialog } from '../revisao-de-recorrentes/_components/mark-occurrence-paid-dialog'
import { DiscardThisMonthDialog } from '../revisao-de-recorrentes/_components/discard-this-month-dialog'
import { LinkToBankButton } from '@/features/open-finance/link-to-bank-button'
import { DiscardEntryButton } from '@/features/novo-lancamento/discard-entry-button'
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api-client'
import { DestinarOLucroDialog } from '@/features/relatorios/destinar-o-lucro-dialog'
// Desligado na tela em 2026-10-09 — ver o bloco "Caixa do mês" abaixo da cascata.
// import { DreCashCard } from '@/features/relatorios/dre-cash-card'
import { DreCategoryEntries, useEntryOrigins } from '@/features/relatorios/dre-category-entries'
import { ReportError } from '@/components/patterns/report-error'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { Badge } from '@/components/ui/badge'
import { RecurringMark } from '@/components/patterns/recurring-mark'
import { CreditCardMark } from '@/components/patterns/credit-card-mark'
import { ToggleChips } from '@/components/patterns/toggle-chips'
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons'
import { HideToggle } from '@/components/patterns/hide-toggle'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardCaption, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * What "Marcar Pago" was pressed on. Figma 11:2 draws the SAME button on a
 * Lançamento row (nó `235:50`) and on a parcela de Passivo row (`235:72`), but
 * they are two different commands behind it — `POST /entries/{id}/payment` and
 * `POST /installments/{id}/payment` — so the target says which.
 */
type MarkPaidTarget =
  | {
      readonly kind: 'Entry'
      readonly entryId: EntryId
      readonly name: string
      readonly amount: Cents
    }
  | {
      readonly kind: 'Installment'
      readonly installmentId: InstallmentId
      readonly liabilityId: LiabilityId
      readonly name: string
      readonly amount: Cents
    }
  | {
      /** A Previsto de recorrência — `POST /occurrences/{id}/payment` (ADR-0019). */
      readonly kind: 'Occurrence'
      readonly occurrenceId: string
      readonly name: string
      readonly amount: Cents
    }

export default function DrePage() {
  const [view, setView] = useReportView()
  const [mounted, setMounted] = React.useState(false)
  const [month, setMonth] = React.useState<Month | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<EntryStatus | null>(null)
  const [statusOverridden, setStatusOverridden] = React.useState(false)
  const [markPaidTarget, setMarkPaidTarget] = React.useState<MarkPaidTarget | null>(null)
  const [allocating, setAllocating] = React.useState(false)
  // "Recorrentes" e "Cartão" (dono, 2026-10-06): recalculam a cascata e a
  // lista no servidor, como a simulação do olhinho (ADR-0021).
  const [onlyRecurring, setOnlyRecurring] = React.useState(false)
  const [onlyCreditCard, setOnlyCreditCard] = React.useState(false)
  // DRE expansível (2026-09-23): todas recolhidas ao abrir — a cascata de 13
  // linhas continua sendo o que se lê primeiro. Mora aqui, e não na cascata,
  // porque o "Exibir tudo" fica na barra de controles (dono, 2026-10-06).
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(new Set())

  // "Hoje" only exists on the device, never on the server (see @/lib/today
  // callers elsewhere) — resolved once, after mount, exactly like the theme
  // toggle resolves its stored value, so the server-rendered HTML and the
  // first client render always agree (no hydration mismatch).
  React.useEffect(() => {
    const today = todayMonth()
    setMonth(today)
    setStatusFilter(defaultStatusFilterFor(today, today))
    setMounted(true)
    // Runs once, at mount, by design — see comment above.
  }, [])

  function changeMonth(next: Month): void {
    setMonth(next)
    // A month the person has not manually overridden the toggle for still
    // follows the "Pago em mês atual/passado, Previsto em mês futuro" default
    // (files_design/01 §8.1) as they navigate — but once they have flipped it
    // by hand for THIS session, their choice sticks across months.
    if (!statusOverridden) {
      setStatusFilter(defaultStatusFilterFor(next, todayMonth()))
    }
  }

  function changeStatus(next: EntryStatus): void {
    setStatusOverridden(true)
    setStatusFilter(next)
  }

  const queryClient = useQueryClient()
  // Simulação "olhinho" (pedido do dono, 2026-10-01): o que a pessoa ocultou
  // para ver o DRE sem. Só nesta tela e só enquanto ela está aberta — nada é
  // gravado, e o aviso acima da cascata diz isso.
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set())
  const hiddenParam = [...hidden].sort().join(',')
  const toggleHidden = (token: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(token)) next.delete(token)
      else next.add(token)
      return next
    })
  const queryKey = [
    'income-statement',
    view,
    month,
    statusFilter,
    hiddenParam,
    onlyRecurring,
    onlyCreditCard,
  ] as const
  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchIncomeStatement({
        view,
        month: month as Month,
        statusFilter: statusFilter as EntryStatus,
        hidden: hiddenParam === '' ? undefined : hiddenParam,
        recurring: onlyRecurring ? 'true' : 'false',
        creditCard: onlyCreditCard ? 'true' : 'false',
      }),
    enabled: mounted && month !== null && statusFilter !== null,
    // O DRE anterior fica na tela enquanto o novo carrega: ocultar um valor não
    // pode piscar a cascata inteira.
    placeholderData: (previous) => previous,
  })

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">DRE</h1>
        {/* P41 (produto, 2026-09-09): manda o MOCKUP, que é a fonte visual
            (ADR-0015). Ele não omitiu a legenda longa do Wireframe — reescreveu:
            o `11:2` traz três parágrafos de ajuda e o Mockup os condensou, que é
            a mesma decisão registrada em files_design/07 ("os três parágrafos de
            ajuda viraram um, com os controles agrupados numa barra"). O código
            seguia o Wireframe, a camada anterior. */}
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Como a receita do mês vira lucro, linha a linha.
        </p>
        {/* files_design/07, provas de conceito: "os três parágrafos de ajuda
            viraram um, com os controles agrupados numa barra". */}
        <div data-dre-controls className="flex flex-wrap items-center gap-16">
          <ViewSwitch value={view} onValueChange={setView} />
          {/* "Ver previsão do mês" (PRD v7.40) saiu em 2026-10-01 a pedido do
              dono: Pago | Previsto já cobre o uso. A API continua aceitando
              `forecast`, sem botão. */}
          <StatusSwitch value={statusFilter ?? 'Paid'} onValueChange={changeStatus} />
          {/* À esquerda do mês (dono, 2026-10-06). */}
          <ToggleChips
            aria-label="Filtrar lançamentos"
            chips={[
              { key: 'recurring', label: 'Recorrentes', pressed: onlyRecurring },
              { key: 'creditCard', label: 'Cartão', pressed: onlyCreditCard },
            ]}
            onToggle={(key) =>
              key === 'recurring' ? setOnlyRecurring((on) => !on) : setOnlyCreditCard((on) => !on)
            }
          />
          {month ? <MonthNav month={month} onMonthChange={changeMonth} /> : null}
        </div>
        <p className="text-style-body-sm text-ink-secondary">
          Navegue entre meses: pra trás revê o resultado real de meses passados; pra frente mostra a
          projeção baseada em recorrências e parcelas já configuradas.
        </p>
      </div>

      {!mounted || month === null || statusFilter === null || query.status === 'pending' ? (
        <Card>
          <Loading label="Carregando DRE" bars={SKELETON_BARS.DRE} />
        </Card>
      ) : query.status === 'error' ? (
        <Card>
          <ReportError onRetry={() => query.refetch()} />
        </Card>
      ) : query.data.rows.length === 0 && (onlyRecurring || onlyCreditCard) ? (
        // Medido em 2026-10-06: com "Cartão" ligado num mês sem compra no
        // cartão, a tela pedia para "registrar uma receita ou despesa pra
        // começar" a quem tem o mês cheio de lançamentos.
        <Card>
          <CardBody className="pt-20">
            <p className="text-style-body-md text-ink-secondary">
              Nenhum lançamento com este filtro.
            </p>
          </CardBody>
        </Card>
      ) : query.data.rows.length === 0 ? (
        <Card>
          <Empty copy={EMPTY_STATES.DRE} actionHref="/novo-lancamento" />
        </Card>
      ) : (
        <DreContent
          statement={query.data}
          onMarkPaid={setMarkPaidTarget}
          onEditHref={(entryId) => `/novo-lancamento?from=dre&entryId=${entryId}`}
          onAllocateProfit={() => setAllocating(true)}
          hidden={hidden}
          onToggleHidden={toggleHidden}
          onShowAll={() => setHidden(new Set())}
          filtering={onlyRecurring || onlyCreditCard}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      )}

      {markPaidTarget?.kind === 'Entry' ? (
        <MarkAsPaidDialog
          open
          onOpenChange={(open) => {
            if (!open) setMarkPaidTarget(null)
          }}
          entryId={markPaidTarget.entryId}
          entryName={markPaidTarget.name}
          plannedAmount={markPaidTarget.amount}
          onPaid={() => queryClient.invalidateQueries({ queryKey })}
        />
      ) : null}

      {markPaidTarget?.kind === 'Occurrence' && query.status === 'success' ? (
        <MarkOccurrencePaidDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setMarkPaidTarget(null)
              void queryClient.invalidateQueries({ queryKey })
            }
          }}
          month={query.data.month as Month}
          occurrenceId={markPaidTarget.occurrenceId}
          title={markPaidTarget.name}
          plannedAmount={markPaidTarget.amount}
        />
      ) : null}

      {markPaidTarget?.kind === 'Installment' ? (
        <MarkInstallmentPaidDialog
          open
          onOpenChange={(open) => {
            if (!open) setMarkPaidTarget(null)
          }}
          liabilityId={markPaidTarget.liabilityId}
          installmentId={markPaidTarget.installmentId}
          title={markPaidTarget.name}
          plannedAmount={markPaidTarget.amount}
          onSuccess={() => queryClient.invalidateQueries({ queryKey })}
        />
      ) : null}

      {allocating && query.status === 'success' ? (
        <DestinarOLucroDialog
          month={query.data.month}
          netProfit={query.data.netProfit}
          open={allocating}
          onOpenChange={setAllocating}
        />
      ) : null}
    </div>
  )
}

function DreContent({
  statement,
  onMarkPaid,
  onEditHref,
  onAllocateProfit,
  hidden,
  onToggleHidden,
  onShowAll,
  filtering,
  expanded,
  onExpandedChange: setExpanded,
}: {
  statement: IncomeStatement
  onMarkPaid: (target: MarkPaidTarget) => void
  onEditHref: (entryId: string) => string
  onAllocateProfit: () => void
  hidden: ReadonlySet<string>
  onToggleHidden: (token: string) => void
  onShowAll: () => void
  /** "Recorrentes" ou "Cartão" ligado: a cascata é recalculada, um recorte. */
  filtering: boolean
  expanded: ReadonlySet<string>
  onExpandedChange: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>
}) {
  const netProfit = statement.netProfit
  const simulating = hidden.size > 0
  // O que veio do banco não se desfaz (dono, 2026-10-06): o servidor recusa,
  // e a linha nem oferece o botão.
  const origins = useEntryOrigins(statement.month)
  const fromBank = new Set((origins.data?.data ?? []).map((origin) => origin.entryId))
  const [openFlows, setOpenFlows] = React.useState<ReadonlySet<'In' | 'Out'>>(new Set())
  const flowsWithRows = (['In', 'Out'] as const).filter((flow) =>
    statement.rows.some((row) => (row.flow ?? 'Out') === flow),
  )
  const allFlowsOpen = flowsWithRows.every((flow) => openFlows.has(flow))
  const toggleFlow = (flow: 'In' | 'Out') =>
    setOpenFlows((current) => {
      const next = new Set(current)
      if (next.has(flow)) next.delete(flow)
      else next.add(flow)
      return next
    })
  // Só se destina o que aconteceu (dono, 2026-10-01: "destinação de lucro
  // previsto não faz sentido"): com a cascata em Previsto, ou durante a
  // simulação do olhinho, o lucro é hipótese e o bloco inteiro some.
  // Também fora com um filtro ligado (2026-10-09): o lucro ali é de um recorte,
  // não do mês.
  const canAllocate = statement.statusFilter === 'Paid' && !simulating && !filtering
  // PRD §5, modelo de dados: "a destinação do lucro é um valor único
  // consolidado, não replicado por entidade". Medido em 2026-10-09: na visão PJ
  // o diálogo oferecia o lucro da PJ (R$ 26.500,00), o servidor validava contra
  // o Consolidado, menor, e recusava com `exceeds_net_profit`.
  const allocatesHere = statement.view === 'Consolidated'
  // Durante a simulação o Lucro Líquido é hipotético: destinar um lucro que
  // não existe gravaria uma decisão sobre um número de mentira.
  const hasProfitToAllocate = !simulating && !isNegative(netProfit) && netProfit !== 0
  const toggleExpanded = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <>
      <Card data-dre-cascade-card>
        <CardBody className="pt-20">
          {/* Dentro do card, sobre a cascata que ele abre (dono, 2026-10-06:
              "melhor dentro"), com cara de botão ("não parece um botão" era o
              texto solto que veio antes). */}
          <div className="flex justify-end pb-8">
            <ExpandAllButton
              statement={statement}
              expanded={expanded}
              onExpandedChange={setExpanded}
            />
          </div>
          <table className="w-full border-collapse">
            <caption className="sr-only">Cascata do DRE de {statement.month}</caption>
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  Operador
                </th>
                <th scope="col" className="sr-only">
                  Linha
                </th>
                <th scope="col" className="sr-only">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.map((line) => {
                const isResult = line.kind === 'subtotal'
                const breakdown = line.kind === 'block' ? line.breakdown : []
                const isOpen = expanded.has(line.key)
                const breakdownId = `dre-breakdown-${line.key}`
                return (
                  <React.Fragment key={`${line.kind}-${line.key}`}>
                    <tr
                      className={
                        isResult
                          ? 'h-[var(--height-table-row)] border-t border-line-default'
                          : 'h-[var(--height-table-row)]'
                      }
                    >
                      <td className="w-[var(--space-24)] px-12 text-style-body-md text-ink-tertiary">
                        <span aria-hidden="true">{operatorFor(line)}</span>
                      </td>
                      <td
                        className={
                          isResult
                            ? 'px-12 text-style-heading-sm text-ink-primary'
                            : 'px-12 text-style-body-md text-ink-primary'
                        }
                      >
                        {breakdown.length > 0 ? (
                          // Só linha de bloco COM movimento ganha a seta: um
                          // subtotal (=) não tem categoria, e um bloco zerado não
                          // tem o que abrir.
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={breakdownId}
                            onClick={() => toggleExpanded(line.key)}
                            className="inline-flex items-center gap-4 rounded-control text-left text-ink-primary"
                          >
                            {line.label}
                            <span className="text-ink-secondary">
                              {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                            </span>
                          </button>
                        ) : (
                          line.label
                        )}
                      </td>
                      <td
                        className={
                          isResult
                            ? 'px-12 text-right text-style-numeric-md font-medium text-ink-primary'
                            : 'px-12 text-right text-style-numeric-md text-ink-primary'
                        }
                      >
                        {/* files_design/07 densidade #9: a zero line is quiet,
                          never printed with the same weight as real movement. */}
                        <span className={line.amount === 0 ? 'text-ink-tertiary' : undefined}>
                          {formatMoney(line.amount)}
                        </span>
                      </td>
                    </tr>
                    {isOpen
                      ? breakdown.map((item, index) => {
                          // Terceiro nível (2026-09-29): a categoria abre os
                          // lançamentos dela, com a descrição real do banco —
                          // os MESMOS que a linha soma: deste bloco, desta
                          // categoria e do status que a cascata está mostrando.
                          const itemKey = `${line.key}|${item.key}`
                          const itemOpen = expanded.has(itemKey)
                          const itemRows = statement.rows.filter(
                            (row) =>
                              row.blockId === line.key &&
                              // A mesma regra da cascata: em Previsto, o pago
                              // e o previsto (dono, 2026-10-09).
                              entersIncomeStatement(row, statement.statusFilter) &&
                              (item.key.startsWith('category:')
                                ? row.categoryId === item.key.slice('category:'.length)
                                : row.categoryId === null),
                          )
                          return (
                            <React.Fragment key={item.key}>
                              <tr
                                id={index === 0 ? breakdownId : undefined}
                                className="h-[var(--height-table-row)]"
                              >
                                <td aria-hidden="true" />
                                <td className="pl-24 pr-12 text-style-body-sm text-ink-secondary">
                                  <span className="inline-flex items-center gap-4">
                                    <HideToggle
                                      hidden={item.hidden === true}
                                      onToggle={() => onToggleHidden(`group:${item.key}`)}
                                    />
                                    <button
                                      type="button"
                                      aria-expanded={itemOpen}
                                      onClick={() => toggleExpanded(itemKey)}
                                      className={cn(
                                        'inline-flex items-center gap-4 rounded-control text-left hover:bg-surface-hover',
                                        item.hidden === true && 'line-through opacity-40',
                                      )}
                                    >
                                      {item.label}
                                      {itemOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                                    </button>
                                  </span>
                                </td>
                                <td
                                  className={cn(
                                    'px-12 text-right text-style-numeric-md text-ink-secondary',
                                    item.hidden === true && 'line-through opacity-40',
                                  )}
                                >
                                  {formatMoney(item.amount)}
                                </td>
                              </tr>
                              {itemOpen ? (
                                <tr>
                                  <td aria-hidden="true" />
                                  <td colSpan={2} className="pb-8 pl-40 pr-12">
                                    <DreCategoryEntries
                                      month={statement.month}
                                      items={itemRows.map((row) => ({
                                        entryId:
                                          row.source.kind === 'Entry' ? row.source.entryId : null,
                                        name: row.name,
                                        description: row.description ?? null,
                                        ...(row.date ? { date: row.date } : {}),
                                        recurring:
                                          row.recurring === true ||
                                          row.source.kind === 'Occurrence',
                                        isCreditCard: row.isCreditCard === true,
                                        categoryId: row.categoryId,
                                        amount: row.amount,
                                        hideToken: hideTokenOf(row),
                                        hidden: row.hidden === true,
                                      }))}
                                      onToggleHidden={onToggleHidden}
                                      editHref={onEditHref}
                                    />
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          )
                        })
                      : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {/* A simulação "olhinho" volta daqui (escolha do dono, 2026-10-01):
              no fim da cascata, abaixo do Lucro Líquido, alinhado aos valores.
              Antes foi um botão acima da cascata ("fica mexendo a tela"), um
              botão fixo e um texto no fim da barra de controles. */}
          {hidden.size > 0 ? (
            <p className="pt-12 text-right text-style-body-sm text-ink-secondary">
              {hidden.size} {hidden.size === 1 ? 'oculto' : 'ocultos'} ·{' '}
              <button
                type="button"
                onClick={onShowAll}
                className="rounded-control text-ink-state underline underline-offset-2 hover:text-ink-primary"
              >
                mostrar
              </button>
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* "Caixa do mês" DESLIGADO na tela (dono, 2026-10-09: "deixa comentado
          esse bloco… ainda não tá como eu quero"). O componente, a conta
          (`cashForecast`/`cashBridge`) e a rota do extrato do mês continuam no
          código, com testes; para religar, descomente o bloco e o import de
          `DreCashCard` acima, e tire o `.skip` dos dois describes do card em
          page.test.tsx.
      {statement.month === todayMonth() ? (
        <DreCashCard view={statement.view} month={statement.month} rows={statement.rows} />
      ) : null}
      */}

      {!canAllocate ? null : !allocatesHere ? (
        <Card>
          <CardBody className="flex flex-col gap-4 pt-20">
            <CardTitle level={2}>Destinar o lucro deste mês</CardTitle>
            <CardCaption>
              A destinação é do resultado consolidado, PF e PJ juntos. Mude a visão para Consolidado
              para destinar.
            </CardCaption>
          </CardBody>
        </Card>
      ) : hasProfitToAllocate ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-16 pt-20">
            <div className="flex flex-col gap-4">
              <CardTitle level={2}>Destinar o lucro deste mês</CardTitle>
              <CardCaption>
                Decida o que fazer com o Lucro Líquido: investir, guardar em reserva, ou distribuir.
              </CardCaption>
            </div>
            {/* "Destinar o Lucro" is a MODAL over the DRE, not a route of its
                own: files_design/01 §9 says "botão dentro do DRE" and
                "pós-salvamento: volta ao DRE", and the Figma frame is 27:2
                "Desktop — Destinar o Lucro (modal sobre DRE)". */}
            <Button variant="primary" onClick={onAllocateProfit}>
              Destinar este Lucro
            </Button>
          </CardBody>
        </Card>
      ) : (
        /* Figma 242:2 ("Estado — DRE com Prejuízo"), word for word: the card
           keeps the same title/caption shape as "Destinar o lucro deste mês",
           it only loses the button. The Prejuízo is printed as a MAGNITUDE —
           the frame reads "Prejuízo de R$ 1.850,00", not "de −R$ 1.850,00":
           the word already carries the sign, and printing both says it twice.

           The block `242:11` (401×34) is ALWAYS two stacked lines — `242:12`
           title (206×17) over `242:13` caption (401×15) — exactly like the
           positive card `239:22` (`239:23` 183×17 + `239:24` 466×15). No frame
           of either Figma page draws a message card with a title and no
           caption, so the caption is not conditional here.

           `242:13` is two independent sentences: the one that names the loss
           and the one that explains it. With a Lucro Líquido of exactly zero
           there is no loss to name, so only the second is printed — it is true
           in both cases, and it is literal frame text, not new copy. */
        <Card>
          <CardBody className="flex flex-col gap-4 pt-20">
            <CardTitle level={2}>Sem lucro a destinar este mês</CardTitle>
            <CardCaption>
              {isNegative(netProfit) ? `Prejuízo de ${formatMoney(negate(netProfit))}. ` : null}
              Não há valor pra investir, guardar ou distribuir.
            </CardCaption>
          </CardBody>
        </Card>
      )}

      <Card data-dre-entries-card>
        <CardHeader className="relative">
          {flowsWithRows.length > 0 ? (
            <div className="absolute right-20 top-20">
              <ExpandAllToggle
                allExpanded={allFlowsOpen}
                onToggle={() => setOpenFlows(allFlowsOpen ? new Set() : new Set(flowsWithRows))}
              />
            </div>
          ) : null}
          <CardTitle level={2}>Lançamentos deste mês</CardTitle>
          {/* P41 — o texto desenhado carrega um FATO que o anterior não dizia:
              esta lista ignora o filtro da cascata. Não era diferença de estilo,
              era informação sumindo. `buildRows` recebe o mês inteiro, sem
              filtrar por status, e é isso que a legenda agora conta. */}
          <CardCaption>
            Mostra pagos e previstos juntos, independente do filtro da cascata.
          </CardCaption>
        </CardHeader>
        <CardBody className="pt-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Lançamento</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader numeric>Valor</TableHeader>
                <TableHeader>
                  <span className="sr-only">Ações</span>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* (+) Entradas e (−) Saídas (pedido do dono, 2026-10-01): a direção
                  é a do efeito no lucro nesta visão, a mesma regra da cascata. */}
              {(['In', 'Out'] as const).map((flow) => {
                const group = statement.rows.filter((row) => (row.flow ?? 'Out') === flow)
                if (group.length === 0) return null
                const groupOpen = openFlows.has(flow)
                return (
                  <React.Fragment key={flow}>
                    {/* Fechado ao abrir a tela (dono, 2026-10-06: "ao invés de
                        mostrar tudo, deixa a pessoa clicar para ver"): o
                        cabeçalho traz o total do grupo e abre as linhas. */}
                    <TableRow>
                      <TableCell colSpan={2}>
                        <button
                          type="button"
                          aria-expanded={groupOpen}
                          onClick={() => toggleFlow(flow)}
                          className="inline-flex items-center gap-4 rounded-control text-left text-style-label-xs uppercase text-ink-secondary hover:text-ink-primary"
                        >
                          {groupOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                          {flow === 'In' ? '(+) Entradas' : '(−) Saídas'}
                          <span className="normal-case">· {group.length}</span>
                        </button>
                      </TableCell>
                      <TableCell numeric className="text-ink-secondary">
                        {formatMoney(sumOf(group))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    {(groupOpen ? group : []).map((row) => (
                      <TableRow
                        key={`${row.source.kind}-${
                          row.source.kind === 'Entry'
                            ? row.source.entryId
                            : row.source.kind === 'Occurrence'
                              ? row.source.occurrenceId
                              : row.source.installmentId
                        }`}
                      >
                        <TableCell>
                          <span className="flex items-center gap-8">
                            {row.name}
                            <Badge tone={row.entity === 'PF' ? 'pf' : 'pj'}>{row.entity}</Badge>
                            {row.source.kind === 'Occurrence' || row.recurring === true ? (
                              <RecurringMark />
                            ) : null}
                            {row.isCreditCard === true ? <CreditCardMark /> : null}
                          </span>
                          {row.description ? (
                            <span className="block truncate text-style-body-sm text-ink-secondary">
                              {row.description}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {row.status === 'Paid' ? (
                            <span className="text-style-body-sm text-ink-tertiary">Pago</span>
                          ) : (
                            <Badge tone="previsto">Previsto</Badge>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {/* "A definir" em branco (2026-10-01): sem número ainda — o
                        valor se informa no Editar ou no Marcar Pago. */}
                          {row.amountToBeDefined === true ? (
                            <span className="text-style-body-sm text-ink-tertiary">A definir</span>
                          ) : (
                            formatMoney(row.amount)
                          )}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            row={row}
                            onMarkPaid={onMarkPaid}
                            onEditHref={onEditHref}
                            fromBank={fromBank}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                )
              })}
              {/* Total no fim (dono, 2026-10-06): o saldo do que a lista mostra —
                  com um filtro ligado, só o filtrado. Linha "a definir" soma zero. */}
              <TotalRow
                label="Saldo"
                amount={
                  (sumOf(statement.rows.filter((row) => (row.flow ?? 'Out') === 'In')) -
                    sumOf(statement.rows.filter((row) => (row.flow ?? 'Out') === 'Out'))) as Cents
                }
                strong
              />
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </>
  )
}

/**
 * A row's action cell — Figma 11:2 ("Desktop — DRE"), card "Lançamentos deste
 * mês" (`340:2`).
 *
 * The frame draws the same two actions on EVERY Previsto row, whatever the row
 * came from: "Internet" (`235:48`), "Contador" (`235:59`) and the parcela de
 * Passivo "Financiamento apartamento, parcela 13" (`235:70`) all carry the same
 * group at x=858, w=154, with "Marcar Pago" (92x27) and "Editar" (56x27) inside.
 * A Pago row (`235:21`, `235:30`, `235:39`) carries the narrow x=956/w=56 group,
 * with "Editar" alone. So the parcela is NOT a special case here — the frame
 * treats it as any other lançamento of the month, and the card's own legend
 * (`239:25`) opens no exception for it either.
 *
 * MEASURED, before this fix: `EntryRowActions` opened with
 * `if (row.source.kind !== 'Entry') return null`, and the parcela row rendered
 * `<td class="px-12 …" />` — an empty cell, 0 buttons and 0 links against the 2
 * the frame draws (DOM read in `page.test.tsx`, "Figma 11:2 §235:64").
 *
 * The old comment justified that emptiness with docs/PERGUNTAS-EM-ABERTO.md P6.
 * P6 asks whether a paid parcela CREATES A LANÇAMENTO — an accounting effect,
 * still open. It never was about whether the row shows the action: the frame
 * decides that, and the command already exists
 * (`mark-installment-paid-dialog.tsx` → `POST /installments/{id}/payment`,
 * the same one Detalhe do Passivo and Revisão de Recorrentes already call).
 *
 * Split into two sibling functions, not inlined in the `.map`, so the
 * `source.kind` narrowing survives into the `onClick`/`href` closures below —
 * TypeScript does not carry a narrowed PROPERTY across a deferred callback
 * boundary, only a narrowed local variable, and `row` here is exactly that: a
 * parameter whose type each function already fixes to one source shape.
 */
function RowActions({
  row,
  onMarkPaid,
  onEditHref,
  fromBank,
}: {
  row: IncomeStatementRow
  onMarkPaid: (target: MarkPaidTarget) => void
  onEditHref: (entryId: string) => string
  fromBank: ReadonlySet<string>
}) {
  if (row.source.kind === 'Occurrence') {
    return (
      <OccurrenceRowActions
        row={row}
        occurrenceId={row.source.occurrenceId}
        onMarkPaid={onMarkPaid}
      />
    )
  }
  return row.source.kind === 'Entry' ? (
    <EntryRowActions
      row={row}
      entryId={row.source.entryId}
      onMarkPaid={onMarkPaid}
      onEditHref={onEditHref}
      undoable={!fromBank.has(row.source.entryId)}
    />
  ) : (
    <InstallmentRowActions
      row={row}
      installmentId={row.source.installmentId}
      liabilityId={row.source.liabilityId}
      onMarkPaid={onMarkPaid}
    />
  )
}

/**
 * A Previsto de recorrência (ADR-0019): uma ocorrência, não um Lançamento.
 * "Marcar Pago" paga a ocorrência, como na Revisão de Recorrentes; "Editar"
 * abre o formulário da série já preenchido (2026-10-01 — antes levava à
 * Revisão, e a pessoa tinha de achar a linha de novo); "Descartar" pergunta
 * se é só este mês ou a série completa.
 * Antes de 2026-09-29 esta linha chegava como Lançamento de id falso e as duas
 * ações quebravam ("Não foi possível carregar este lançamento").
 */
function OccurrenceRowActions({
  row,
  occurrenceId,
  onMarkPaid,
}: {
  row: IncomeStatementRow
  occurrenceId: string
  onMarkPaid: (target: MarkPaidTarget) => void
}) {
  return (
    <div className="flex justify-end gap-8">
      <Button
        variant="secondary"
        size="compact"
        onClick={() =>
          onMarkPaid({ kind: 'Occurrence', occurrenceId, name: row.name, amount: row.amount })
        }
      >
        Confirmar
      </Button>
      <Button asChild variant="secondary" size="compact">
        <Link href={`/novo-lancamento?from=dre&occurrenceId=${occurrenceId}`}>Editar</Link>
      </Button>
      <DiscardThisMonthButton
        title={row.name}
        path={`/occurrences/${occurrenceId}/discard`}
        offerWholeSeries
      />
    </div>
  )
}

function EntryRowActions({
  row,
  entryId,
  onMarkPaid,
  onEditHref,
  undoable,
}: {
  row: IncomeStatementRow
  entryId: EntryId
  onMarkPaid: (target: MarkPaidTarget) => void
  onEditHref: (entryId: string) => string
  undoable: boolean
}) {
  return (
    <div className="flex justify-end gap-8">
      {row.status === 'Paid' && undoable ? <UndoPaymentButton entryId={entryId} /> : null}
      {/* Feito à mão: liga à transação do banco (dono, 2026-10-09). */}
      {undoable ? <LinkToBankButton entryId={entryId} entryName={row.name} /> : null}
      {row.status === 'Planned' ? (
        <Button
          variant="secondary"
          size="compact"
          onClick={() => onMarkPaid({ kind: 'Entry', entryId, name: row.name, amount: row.amount })}
        >
          Confirmar
        </Button>
      ) : null}
      {/* files_design/07-style-guide.md, "No DRE": "'Editar' virou ação em
          texto azul" — a Hierarquia de cor do mesmo doc lista "ação em linha"
          sob Azul (`color/text/state`). O variant "text" do Botão é neutro
          por padrão (mesmo padrão de override já usado em
          `confirm-action-button.tsx` com `text-ink-negative`); aqui a cor
          semântica certa é `text-ink-state`. */}
      <Button asChild variant="secondary" size="compact">
        <Link href={onEditHref(entryId)}>Editar</Link>
      </Button>
      <DiscardEntryButton
        entryId={entryId}
        entryName={row.name}
        hasRecurrence={row.recurring === true}
      />
    </div>
  )
}

/**
 * A parcela de Passivo row, Figma 11:2 nó `235:70`.
 *
 * Two literal texts, in the frame's order: `235:72` "Marcar Pago" and `235:74`
 * "Editar". "Marcar **Pago**" is what THIS frame writes — Detalhe do Passivo
 * writes "Marcar **Paga**" on its own parcela list (Figma 91:2, nós `91:123` e
 * `91:131`), and each label is copied from its own frame.
 *
 * "Editar" points at Detalhe do Passivo (`/passivos/{liabilityId}`, Figma
 * 91:2): a parcela is edited there — renegotiated, discarded, marked paid —
 * never on the Novo Lançamento form, which only knows Lançamentos.
 */
function InstallmentRowActions({
  row,
  installmentId,
  liabilityId,
  onMarkPaid,
}: {
  row: IncomeStatementRow
  installmentId: InstallmentId
  liabilityId: LiabilityId
  onMarkPaid: (target: MarkPaidTarget) => void
}) {
  return (
    <div className="flex justify-end gap-8">
      {row.status === 'Planned' ? (
        <Button
          variant="secondary"
          size="compact"
          onClick={() =>
            onMarkPaid({
              kind: 'Installment',
              installmentId,
              liabilityId,
              name: row.name,
              amount: row.amount,
            })
          }
        >
          Confirmar
        </Button>
      ) : null}
      <Button asChild variant="secondary" size="compact">
        <Link href={`/passivos/${liabilityId}`}>Editar</Link>
      </Button>
      {/* `encodeURIComponent`: o id da Parcela é `${liabilityId}#${n}`, e um `#`
          cru vira fragmento (ver useDiscardInstallment na Revisão). */}
      <DiscardThisMonthButton
        title={row.name}
        path={`/installments/${encodeURIComponent(installmentId)}/discard`}
      />
    </div>
  )
}

/**
 * "Desfazer" (dono, 2026-10-06): o Pago (ou Recebido) volta a Previsto com a
 * data e o valor do pagamento, que são os únicos guardados. Num mês de série o
 * servidor reabre a ocorrência em vez de deixar um Previsto avulso (ADR-0019).
 * O PATCH exige o `kind`, que a linha do relatório não carrega — daí o GET.
 */
function UndoPaymentButton({ entryId }: { entryId: EntryId }) {
  const client = useQueryClient()
  const undo = useMutation({
    mutationFn: async () => {
      const entry = await apiGet<{ kind: string }>(`/entries/${encodeURIComponent(entryId)}`)
      return apiPatch(`/entries/${encodeURIComponent(entryId)}`, {
        kind: entry.kind,
        status: 'Planned',
      })
    },
    onSuccess: () => client.invalidateQueries(),
  })
  return (
    <span className="flex flex-col items-end gap-4">
      <Button
        variant="secondary"
        size="compact"
        disabled={undo.isPending}
        onClick={() => undo.mutate()}
      >
        Desfazer
      </Button>
      {undo.isError ? (
        <span role="alert" className="text-style-body-sm text-ink-negative">
          {undo.error instanceof ApiError ? undo.error.message : 'Não foi possível desfazer.'}
        </span>
      ) : null}
    </span>
  )
}

/**
 * "Descartar" de uma previsão do mês que não é um Lançamento — a ocorrência de
 * uma recorrência ou a parcela de um Passivo (pedido do dono, 2026-10-01). O
 * mesmo diálogo e o mesmo efeito da Revisão de Recorrentes: pula só este mês, a
 * série continua. Invalida tudo porque o DRE, a Revisão e a Home leem o mês.
 */
function DiscardThisMonthButton({
  title,
  path,
  offerWholeSeries = false,
}: {
  title: string
  path: string
  /** Recorrência: "Só este mês" ou "A série completa" (2026-10-01). */
  offerWholeSeries?: boolean
}) {
  const client = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const discard = useMutation({
    mutationFn: (wholeSeries: boolean) =>
      apiPost<unknown>(`${path}${wholeSeries ? '?closeRecurrence=true' : ''}`),
    onSuccess: () => {
      setOpen(false)
      void client.invalidateQueries()
    },
  })
  return (
    <>
      <Button
        variant="secondary"
        size="compact"
        className="text-ink-negative"
        onClick={() => setOpen(true)}
      >
        Descartar
      </Button>
      <DiscardThisMonthDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        isPending={discard.isPending}
        isError={discard.isError}
        offerWholeSeries={offerWholeSeries}
        onConfirm={(wholeSeries) => discard.mutate(wholeSeries)}
      />
    </>
  )
}

function sumOf(rows: readonly IncomeStatementRow[]): Cents {
  return rows.reduce((total, row) => total + row.amount, 0) as Cents
}

function TotalRow({
  label,
  amount,
  strong = false,
}: {
  label: string
  amount: Cents
  strong?: boolean
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={2}
        className={cn(
          'text-style-body-sm text-ink-secondary',
          strong && 'text-style-body-md font-medium text-ink-primary',
        )}
      >
        {label}
      </TableCell>
      <TableCell numeric className={cn(strong && 'font-medium text-ink-primary')}>
        {formatMoney(amount)}
      </TableCell>
      <TableCell />
    </TableRow>
  )
}

/**
 * "Exibir tudo / Recolher tudo" (dono, 2026-10-06: "repensar o exibir tudo").
 * Era um texto solto no canto do card ("não parece um botão"); passou pela
 * barra de controles e voltou para dentro do card ("melhor dentro"), agora
 * como botão secundário com a seta que diz o que ele faz. Abre os blocos
 * com movimento e todas as categorias deles — as mesmas chaves que cada seta
 * da cascata abre.
 */
function ExpandAllButton({
  statement,
  expanded,
  onExpandedChange,
}: {
  statement: IncomeStatement
  expanded: ReadonlySet<string>
  onExpandedChange: (next: ReadonlySet<string>) => void
}) {
  const allKeys = statement.lines.flatMap((line) =>
    line.kind === 'block' && line.breakdown.length > 0
      ? [line.key, ...line.breakdown.map((item) => `${line.key}|${item.key}`)]
      : [],
  )
  if (allKeys.length === 0) return null
  const allExpanded = allKeys.every((key) => expanded.has(key))
  return (
    <ExpandAllToggle
      allExpanded={allExpanded}
      onToggle={() => onExpandedChange(allExpanded ? new Set() : new Set(allKeys))}
    />
  )
}

/** O botão em si — o mesmo na cascata e em "Lançamentos deste mês" (dono, 2026-10-06). */
function ExpandAllToggle({
  allExpanded,
  onToggle,
}: {
  allExpanded: boolean
  onToggle: () => void
}) {
  return (
    <Button
      variant="secondary"
      size="compact"
      className="gap-4"
      aria-expanded={allExpanded}
      onClick={onToggle}
    >
      <span className={cn('inline-flex', allExpanded && 'rotate-180')}>
        <ChevronDownIcon />
      </span>
      {allExpanded ? 'Recolher tudo' : 'Exibir tudo'}
    </Button>
  )
}

/** O token de `hidden=` (contrato do relatório) para uma linha da tabela. */
function hideTokenOf(row: IncomeStatementRow): string {
  switch (row.source.kind) {
    case 'Entry':
      return `entry:${row.source.entryId}`
    case 'Occurrence':
      return `occurrence:${row.source.occurrenceId}`
    case 'Installment':
      return `installment:${row.source.installmentId}`
  }
}

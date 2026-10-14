'use client'

/**
 * Evolução Mensal — files_design/01 §8.3, Figma 23:2.
 *
 * Chart on top, detailed table underneath (files_design/07 sistema de
 * gráfico #9: "toda tela de gráfico tem a tabela do mesmo dado embaixo").
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { type Cents, type IsoDate, type Month, formatMoney, formatMonthShort } from '@/domain/core'
import {
  LABEL_MONTHLY_TREND_RANGE,
  MONTHLY_TREND_RANGES,
  type MonthlyTrendRange,
} from '@/domain/reports'
import { todayIsoDate, todayMonth } from '@/lib/today'
import { fetchMonthlyTrend } from '@/lib/reports-client'
import { useReportView } from '@/lib/use-report-view'
import { ViewSwitch } from '@/components/patterns/view-switch'
import { ReportError } from '@/components/patterns/report-error'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { MonthlyTrendChart } from '@/components/patterns/monthly-trend-chart'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { Card, CardBody } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const RANGE_OPTIONS = MONTHLY_TREND_RANGES.map((range) => ({
  value: range,
  label: LABEL_MONTHLY_TREND_RANGE[range],
}))

interface Clock {
  readonly until: Month
  readonly asOf: IsoDate
}

export default function EvolucaoMensalPage() {
  const [view, setView] = useReportView()
  const [range, setRange] = React.useState<MonthlyTrendRange>('LastSixMonths')
  const [mounted, setMounted] = React.useState(false)
  const [clock, setClock] = React.useState<Clock | null>(null)

  React.useEffect(() => {
    setClock({ until: todayMonth(), asOf: todayIsoDate() })
    setMounted(true)
  }, [])

  const query = useQuery({
    queryKey: ['monthly-trend', view, range, clock],
    queryFn: () =>
      fetchMonthlyTrend({
        view,
        range,
        until: (clock as Clock).until,
        asOf: (clock as Clock).asOf,
      }),
    enabled: mounted && clock !== null,
  })

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Evolução Mensal</h1>
        {/* P41 (produto, 2026-09-09): o texto do Mockup, que é a fonte visual
            (ADR-0015). O código seguia o Wireframe, a camada anterior. */}
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Como receita, lucro e patrimônio mudaram mês a mês.
        </p>
        <p className="text-style-body-sm text-ink-secondary">
          Veja a evolução consolidada (PF + PJ juntos), ou separada por entidade.
        </p>
        <ViewSwitch value={view} onValueChange={setView} />
      </div>

      {!mounted || clock === null || query.status === 'pending' ? (
        <Card>
          <Loading label="Carregando Evolução Mensal" bars={SKELETON_BARS.EVOLUCAO_MENSAL} />
        </Card>
      ) : query.status === 'error' ? (
        <Card>
          <ReportError onRetry={() => query.refetch()} />
        </Card>
      ) : query.data.points.length < 2 ? (
        <Card>
          <Empty copy={EMPTY_STATES.EVOLUCAO_MENSAL} />
        </Card>
      ) : (
        <Card>
          <CardBody className="flex flex-col gap-24 pt-20">
            <div className="flex flex-col gap-16">
              {/* Figma "Desktop — Evolução Mensal", `Card / Gráfico de
                  evolução` › Título: "Lucro Líquido por entidade". O texto
                  anterior ("no período selecionado") descrevia o seletor logo
                  abaixo; o desenhado descreve o que o gráfico separa, que é a
                  informação que o título precisa dar. */}
              <h2 className="text-style-heading-sm text-ink-primary">Lucro Líquido por entidade</h2>
              <SegmentedControl
                value={range}
                onValueChange={setRange}
                options={RANGE_OPTIONS}
                aria-label="Intervalo"
              />
              <MonthlyTrendChart
                view={view}
                points={query.data.points.map((point) => ({
                  month: point.month,
                  value: point.netProfit,
                }))}
              />
            </div>

            {/* `Card / Detalhamento mês a mês` › `Cabeçalho do card`
                (heading.sm) — a tabela entrava sem título nenhum. */}
            <div className="flex flex-col gap-16">
              <h2 className="text-style-heading-sm text-ink-primary">Detalhamento mês a mês</h2>
              <MonthlyTrendTable points={query.data.points} />
            </div>
            {/* P21 — decisão de produto de 2026-09-08, redação aprovada.
                Nenhum frame do Figma desenha esta nota (conferido em 23:2: a
                linha "Patrimônio Líquido" é só rótulo e valores), então ela é
                a peça desta tela que ainda precisa passar pelo design.
                Existe porque só o mês mais recente carrega o Balanço medido;
                os anteriores são reconstruídos, e o tipo agora diz qual é qual
                (`netWorthIsReconstructed`). Sem travessão, sem emoji, seguindo
                a regra de escrita do files_design/00. */}
            {query.data.points.some((point) => point.netWorthIsReconstructed) ? (
              <p className="text-style-body-sm text-ink-secondary">
                Só o Patrimônio Líquido do mês mais recente é medido. Os anteriores são calculados a
                partir do lucro de cada mês, e podem divergir se você corrigiu algum saldo à mão.
              </p>
            ) : null}
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function MonthlyTrendTable({
  points,
}: {
  points: readonly {
    month: Month
    revenue: Cents
    ebitda: Cents
    netProfit: Cents
    netWorth: Cents
  }[]
}) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Métrica</TableHeader>
          {points.map((point) => (
            <TableHeader key={point.month} numeric>
              {formatMonthShort(point.month)}
            </TableHeader>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>Receita</TableCell>
          {points.map((point) => (
            <TableCell key={point.month} numeric>
              {formatMoney(point.revenue)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell>EBITDA</TableCell>
          {points.map((point) => (
            <TableCell key={point.month} numeric>
              {formatMoney(point.ebitda)}
            </TableCell>
          ))}
        </TableRow>
        {/* files_design/07, provas de conceito: "linha de Lucro Líquido
            sombreada na tabela" — a light background tint, never colour on the
            number itself (Lucro Líquido is never green/red, doc07 regra 11). */}
        <TableRow className="bg-surface-subtle">
          <TableCell className="font-medium">Lucro Líquido</TableCell>
          {points.map((point) => (
            <TableCell key={point.month} numeric className="font-medium">
              {formatMoney(point.netProfit)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow>
          <TableCell>Patrimônio Líquido</TableCell>
          {points.map((point) => (
            <TableCell key={point.month} numeric>
              {formatMoney(point.netWorth)}
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  )
}

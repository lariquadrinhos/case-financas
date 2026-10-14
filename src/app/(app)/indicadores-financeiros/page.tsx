'use client'

/**
 * Indicadores Financeiros — files_design/01 §8.4, Figma 25:2, catalogue and
 * formatting rules in files_design/08 §10.
 *
 * `statusFilter` is SENT but never OFFERED as a control — by POSITIVE design
 * decision, not by absence of evidence. The contract requires the field
 * (`financialIndicatorsQuerySchema`, `src/api/contracts/reports.ts`), so the
 * screen must supply it, and the design says where the value comes from:
 * the legend node `291:2` (Wireframe 25:2) / `858:582` (Mockup 858:538) reads
 * "pra frente mostra a projeção baseada em recorrências e parcelas já
 * configuradas", and files_design/08 §10 closes the rule — a future month is
 * "recalculado com base em lançamentos 'Previsto' … sem marcação visual
 * adicional além da legenda que o seletor de mês já mostra". So the value is
 * DERIVED from the month, by the same `defaultStatusFilterFor` the DRE uses.
 *
 * The DRE has the toggle because the design GAVE it one: its control bar
 * `398:5` (Mockup 397:2) holds two segmented instances — `701:50` (entidade,
 * 199x38) and `701:57` (Pago/Previsto, 144x38). This screen's control bar
 * `858:571` holds exactly one, `858:572` (entidade, 199x38).
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { type EntryStatus, type IsoDate, type Month } from '@/domain/core'
import {
  INDICATOR_DEFINITIONS,
  LABEL_INDICATOR_FAMILY,
  defaultStatusFilterFor,
  type Indicator,
  type IndicatorFamily,
} from '@/domain/reports'
import { formatIndicatorValue } from '@/lib/indicator-format'
import { todayIsoDate, todayMonth } from '@/lib/today'
import { fetchFinancialIndicators } from '@/lib/reports-client'
import { useReportView } from '@/lib/use-report-view'
import { ViewSwitch } from '@/components/patterns/view-switch'
import { MonthNav } from '@/components/patterns/month-nav'
import { ReportError } from '@/components/patterns/report-error'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { Card, CardBody, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/patterns/info-tooltip'

interface Clock {
  readonly month: Month
  readonly asOf: IsoDate
}

/**
 * The two-column grouping Figma 25:2 actually draws (`Frame 9` / `Frame 10`):
 * "pensado pra equilibrar a altura total das duas colunas, não por ordem
 * alfabética" (files_design/08 §10) — kept literal, not re-derived.
 */
const LEFT_COLUMN: readonly IndicatorFamily[] = [
  'Profitability',
  'Leverage',
  'FinancialQualityOfLife',
]
const RIGHT_COLUMN: readonly IndicatorFamily[] = ['NetWorthGrowth', 'Liquidity']

export default function IndicadoresFinanceirosPage() {
  const [view, setView] = useReportView()
  const [mounted, setMounted] = React.useState(false)
  const [clock, setClock] = React.useState<Clock | null>(null)

  React.useEffect(() => {
    setClock({ month: todayMonth(), asOf: todayIsoDate() })
    setMounted(true)
  }, [])

  function changeMonth(next: Month): void {
    setClock((current) => (current ? { ...current, month: next } : current))
  }

  // files_design/08 §10: the month decides the base, the person does not.
  const statusFilter: EntryStatus | null = clock
    ? defaultStatusFilterFor(clock.month, todayMonth())
    : null

  const query = useQuery({
    queryKey: ['financial-indicators', view, clock, statusFilter],
    queryFn: () =>
      fetchFinancialIndicators({
        view,
        month: (clock as Clock).month,
        asOf: (clock as Clock).asOf,
        statusFilter: statusFilter as EntryStatus,
      }),
    enabled: mounted && clock !== null && statusFilter !== null,
  })

  const familiesOf = (
    data: NonNullable<typeof query.data>,
  ): Record<IndicatorFamily, Indicator[]> => ({
    Profitability: [...data.profitability],
    Liquidity: [...data.liquidity],
    Leverage: [...data.leverage],
    NetWorthGrowth: [...data.netWorthGrowth],
    FinancialQualityOfLife: [...data.financialQualityOfLife],
  })

  const isEmpty =
    query.status === 'success' &&
    Object.values(familiesOf(query.data))
      .flat()
      .every((indicator) => indicator.value === null)

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Indicadores Financeiros</h1>
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Indicadores Financeiros: números que resumem a saúde financeira, calculados a partir do
          DRE e do Balanço, sem precisar montar fórmula manual.
        </p>
        <p className="text-style-body-sm text-ink-secondary">
          Veja a evolução consolidada (PF + PJ juntos), ou separada por entidade.
        </p>
        {/* A "Barra de controles" desta tela tem UM controle: Figma 25:29
            (Wireframe, 214x31, y=177) / 858:571 → 858:572 (Mockup, 199x38,
            y=90). O seletor de mês NÃO fica nela — ao contrário do DRE, onde
            398:19 fica na mesma linha, em x=900 dentro de 398:5. */}
        <div className="flex flex-wrap items-center gap-16">
          <ViewSwitch value={view} onValueChange={setView} />
        </div>
        <p className="text-style-body-sm text-ink-secondary">
          Navegue entre meses: pra trás revê indicadores de meses passados; pra frente mostra a
          projeção baseada em recorrências e parcelas já configuradas.
        </p>
        {/* Figma 143:2 (Wireframe, x=48 y=263) / 858:575 (Mockup, x=0 y=162):
            o seletor de mês vem em linha própria, DEPOIS da legenda 291:2 /
            858:582 — que é justamente a legenda que explica a projeção. */}
        {clock ? <MonthNav month={clock.month} onMonthChange={changeMonth} /> : null}
      </div>

      {!mounted || clock === null || statusFilter === null || query.status === 'pending' ? (
        <Card>
          {/* Figma 309:83 "Carregando — Indicadores Financeiros" desenha 4
              barras (309:84..309:87, larguras 200/280/260/240), não 8. */}
          <Loading
            label="Carregando Indicadores Financeiros"
            bars={SKELETON_BARS.INDICADORES_FINANCEIROS}
          />
        </Card>
      ) : query.status === 'error' ? (
        <Card>
          <ReportError onRetry={() => query.refetch()} />
        </Card>
      ) : isEmpty ? (
        <Card>
          <Empty copy={EMPTY_STATES.INDICADORES_FINANCEIROS} actionHref="/contas-bancarias" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-24 md:grid-cols-2">
          <div className="flex flex-col gap-24">
            {LEFT_COLUMN.map((family) => (
              <IndicatorFamilyCard
                key={family}
                family={family}
                indicators={familiesOf(query.data)[family]}
              />
            ))}
          </div>
          <div className="flex flex-col gap-24">
            {RIGHT_COLUMN.map((family) => (
              <IndicatorFamilyCard
                key={family}
                family={family}
                indicators={familiesOf(query.data)[family]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A frase de ajuda é conteúdo estático derivado da chave, não dado do mês: ela
 * sai da definição do domínio, e não viaja no HTTP a cada requisição.
 */
function helpFor(key: string): string {
  return INDICATOR_DEFINITIONS.find((definition) => definition.key === key)?.help ?? ''
}

function IndicatorFamilyCard({
  family,
  indicators,
}: {
  family: IndicatorFamily
  indicators: readonly Indicator[]
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-16 pt-20">
        <CardTitle level={2}>{LABEL_INDICATOR_FAMILY[family]}</CardTitle>
        <div className="flex flex-col gap-8">
          {indicators.map((indicator) => (
            <div key={indicator.key} className="flex items-baseline justify-between gap-16">
              {/* files_design/05 §7, decidido em 2026-09-11: a tela EXPLICA o
                  que o número é e não julga se ele é bom. A faixa de referência
                  ("saudável é acima de 1,5") foi recusada — o limiar é conteúdo
                  financeiro e o PRD proíbe faixa e cor de julgamento. */}
              <span className="flex items-center gap-8 text-style-body-md text-ink-primary">
                {indicator.label}
                <InfoTooltip label={`Ajuda sobre ${indicator.label}`}>
                  <p>{helpFor(indicator.key)}</p>
                </InfoTooltip>
              </span>
              <span
                className={
                  indicator.value === null
                    ? 'text-style-numeric-md text-ink-tertiary'
                    : 'text-style-numeric-md text-ink-primary'
                }
              >
                {formatIndicatorValue(indicator, family)}
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

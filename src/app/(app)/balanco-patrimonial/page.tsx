'use client'

/**
 * Balanço Patrimonial — files_design/01 §8.2, Wireframe 21:2, Mockup 848:50.
 *
 * A photo of the present moment, never a series (`@/domain/reports`
 * `BalanceSheet` header comment) — there is no month selector on this screen
 * (files_design/03 "Relatórios — parâmetros comuns": "Balanço Patrimonial não
 * usa seletor de mês — é sempre a posição do momento atual").
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { type Cents, type IsoDate, formatDate, formatMoney } from '@/domain/core'
import type { BalanceSheetItem } from '@/domain/reports'
import { todayIsoDate } from '@/lib/today'
import { fetchBalanceSheet } from '@/lib/reports-client'
import { useReportView } from '@/lib/use-report-view'
import { ViewSwitch } from '@/components/patterns/view-switch'
import { ReportError } from '@/components/patterns/report-error'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { Card, CardTitle } from '@/components/ui/card'

export default function BalancoPatrimonialPage() {
  const [view, setView] = useReportView()
  const [mounted, setMounted] = React.useState(false)
  const [asOf, setAsOf] = React.useState<IsoDate | null>(null)

  React.useEffect(() => {
    setAsOf(todayIsoDate())
    setMounted(true)
  }, [])

  const query = useQuery({
    queryKey: ['balance-sheet', view, asOf],
    queryFn: () => fetchBalanceSheet({ view, asOf: asOf as IsoDate }),
    enabled: mounted && asOf !== null,
  })

  const totalItems =
    query.status === 'success'
      ? query.data.currentAssets.items.length +
        query.data.nonCurrentAssets.items.length +
        query.data.currentLiabilities.items.length +
        query.data.nonCurrentLiabilities.items.length
      : null

  const isEmpty = totalItems === 0

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Balanço Patrimonial</h1>
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Balanço Patrimonial: uma foto de tudo que você tem (Ativo) e tudo que deve (Passivo)
          agora, neste instante. Não é histórico, é sempre a posição atual.
        </p>
        {/* O cabeçalho do estado vazio para AQUI. O Mockup 1030:3256 ("Desktop
            — Vazio — Balanço Patrimonial (claro)") e o Wireframe 310:455
            desenham, no frame "Cabeçalho" (1030:3285, 1088×56), só o h1 e este
            parágrafo: nem a frase "Veja o balanço consolidado…", nem o Controle
            segmentado, nem "posição em …". Sem um único item cadastrado, um
            seletor de visão e uma data de posição não filtram nem datam coisa
            alguma. */}
        {isEmpty ? null : (
          <>
            <p className="text-style-body-sm text-ink-secondary">
              Veja o balanço consolidado (PF + PJ juntos), ou separado por entidade.
            </p>
            <ViewSwitch value={view} onValueChange={setView} />
            {asOf ? (
              <p className="text-style-body-sm text-ink-secondary">posição em {formatDate(asOf)}</p>
            ) : null}
          </>
        )}
      </div>

      {!mounted || asOf === null || query.status === 'pending' ? (
        <Card>
          {/* Carregando — Balanço Patrimonial (309:75): TRÊS barras
              (309:76/309:77/309:78), não seis. */}
          <Loading
            label="Carregando Balanço Patrimonial"
            bars={SKELETON_BARS.BALANCO_PATRIMONIAL}
          />
        </Card>
      ) : query.status === 'error' ? (
        <Card>
          <ReportError onRetry={() => query.refetch()} />
        </Card>
      ) : isEmpty ? (
        /* Sem Card em volta: em 1030:3344 ("Centralizar", 1088 de largura) o
           bloco "Estado vazio" de 420 (1030:3345) fica solto sobre o canvas,
           centrado na coluna — não dentro de um card de largura total. */
        <Empty copy={EMPTY_STATES.BALANCO_PATRIMONIAL} actionHref="/contas-bancarias" />
      ) : (
        <div className="grid grid-cols-1 gap-24 md:grid-cols-2">
          {/* Card / Ativo (848:46) e Card / Passivo + Patrimônio Líquido
              (848:48): dentro de cada card as linhas são TODAS irmãs, sem
              cabeçalho de sub-grupo. No Wireframe 21:2, "Contas bancárias"
              (circulante, nó 21:44) e "Imóvel"/"Veículo"/"Investimentos" (não
              circulante, 21:52/21:56/21:60) são frames irmãos de 483×32
              espaçados de 36 em 36 dentro do mesmo card 21:38; no Mockup são
              quatro instâncias seguidas de "Linha / linha". Medido: `grep -rni
              circulante docs/figma/frames/` devolve 21 ocorrências — Novo
              Lançamento, Passivos, Onboarding 5, Detalhe do Passivo e o tooltip
              de ajuda — e ZERO em qualquer frame de Balanço. A classificação
              decide de que lado da conta o item entra (PRD, "Balanço
              Patrimonial"), não vira título na tela. */}
          <Card>
            <div className="flex flex-col gap-4 p-16">
              <CardTitle level={2}>Ativo</CardTitle>
              <ItemList
                items={[...query.data.currentAssets.items, ...query.data.nonCurrentAssets.items]}
              />
              <FinalRow label="Total do Ativo" amount={query.data.totalAssets} />
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-4 p-16">
              <CardTitle level={2}>Passivo + Patrimônio Líquido</CardTitle>
              <ItemList
                items={[
                  ...query.data.currentLiabilities.items,
                  ...query.data.nonCurrentLiabilities.items,
                ]}
              />
              <SubtotalRow label="Total do Passivo" amount={query.data.totalLiabilities} />
              <FinalRow label="Patrimônio Líquido" amount={query.data.netWorth} />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

/**
 * "Linha / linha" (848:7 e irmãs) — 44px de altura (`espaco-12` em cima e
 * embaixo de uma entrelinha de 20), rótulo `body.md` à esquerda e valor
 * `numeric.md` à direita, recuados `espaco-16` da borda do card.
 */
function ItemList({ items }: { items: readonly BalanceSheetItem[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li
          key={`${item.source.kind}-${sourceIdOf(item.source)}`}
          className="flex items-baseline justify-between gap-16 px-16 py-12"
        >
          <span className="text-style-body-md text-ink-primary">{item.label}</span>
          {/* files_design/07 densidade #9: uma linha zerada é discreta, nunca
              impressa com o mesmo peso de movimento real. */}
          <span
            className={
              item.amount === 0
                ? 'text-style-numeric-md text-ink-tertiary'
                : 'text-style-numeric-md text-ink-primary'
            }
          >
            {formatMoney(item.amount)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The row's stable identity. Keying on the LABEL instead would collide the
 * moment two accounts share a name ("Nubank" for PF and "Nubank" for PJ is a
 * perfectly ordinary setup) — React would then reuse one row's DOM for the
 * other's amount.
 */
function sourceIdOf(source: BalanceSheetItem['source']): string {
  switch (source.kind) {
    case 'BankAccount':
      return source.bankAccountId
    case 'Investment':
      return source.investmentId
    case 'TangibleAsset':
      return source.tangibleAssetId
    case 'Liability':
      return source.liabilityId
  }
}

/**
 * "Linha / subtotal" (848:36) — no Balanço só o "Total do Passivo" usa esta
 * forma: 44px, faixa `superficie-sutil` (→ `bg-surface-subtle`), rótulo e valor
 * em peso médio, e SEM régua acima. Medido com `get_variable_defs` no nó
 * 848:36: `superficie-sutil`, `body.md-medium`, `numeric.md-medium` — nenhuma
 * `borda-forte`, ao contrário de 848:41.
 */
function SubtotalRow({ label, amount }: { label: string; amount: Cents }) {
  return (
    <div className="flex items-baseline justify-between gap-16 bg-surface-subtle px-16 py-12">
      <span className="text-style-body-md font-medium text-ink-primary">{label}</span>
      <span className="text-style-numeric-md font-medium text-ink-primary">
        {formatMoney(amount)}
      </span>
    </div>
  )
}

/**
 * "Linha / final" (848:23 "Total do Ativo" e 848:41 "Patrimônio Líquido") —
 * 58px, régua `borda-forte` (→ `border-line-strong`) acima, rótulo `heading.sm`
 * e valor `numeric.lg` (20/26 SemiBold). Medido com `get_variable_defs` nos
 * dois nós; os 58px saem de 26 de entrelinha do `numeric.lg` mais `espaco-16`
 * em cima e embaixo.
 */
function FinalRow({ label, amount }: { label: string; amount: Cents }) {
  return (
    <div className="flex items-baseline justify-between gap-16 border-t border-line-strong px-16 py-16">
      <span className="text-style-heading-sm text-ink-primary">{label}</span>
      <span className="text-style-numeric-lg text-ink-primary">{formatMoney(amount)}</span>
    </div>
  )
}

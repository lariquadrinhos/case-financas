'use client'

import * as React from 'react'
import { Card, CardBody, CardHeader, CardTitle, CardCaption } from '@/components/ui/card'
import { Treemap } from '@/components/patterns/treemap'
import { Empty } from '@/components/patterns/empty'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { add, formatMoney, subtract, type Cents, type Entity } from '@/domain/core'
import { todayIsoDate } from '@/lib/today'
import { useMoneyMap } from '../_lib/queries'
import type { BalanceSheet } from '../_lib/queries'
import { BlockDetailModal, type MoneyBlockSelection } from './modals/block-detail-modal'

// files_design/08 §2.3: a ALTURA de cada faixa é fixa; a largura "acompanha o
// card" e por isso é medida pelo próprio <Treemap>, nunca fixada aqui.
const ASSETS_HEIGHT = 150
const LIABILITIES_HEIGHT = 60
// files_design/08 §2.11: a largura a partir da qual o §2.6 mostra nome, valor
// e seta — o piso da faixa de dívidas, que é proporcional aos ativos.
const LIABILITIES_MIN_WIDTH = 120

type MoneyBlockKind = 'BankAccount' | 'Investment' | 'Liability'

/** The block's REAL underlying id (never a display-only composite) — it is
 * what "Detalhe do Bloco" needs to redirect money in or out of it. */
function realIdOf(source: BalanceSheet['currentAssets']['items'][number]['source']): string {
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

interface RawBlockItem {
  readonly id: string
  readonly name: string
  readonly value: Cents
  readonly entity: Entity
  readonly kind: MoneyBlockKind
}

function itemsOfKind(sheet: BalanceSheet, kinds: readonly MoneyBlockKind[]): RawBlockItem[] {
  const groups = [
    sheet.currentAssets,
    sheet.nonCurrentAssets,
    sheet.currentLiabilities,
    sheet.nonCurrentLiabilities,
  ]
  return groups
    .flatMap((group) => group.items)
    .filter((item): item is typeof item & { source: { kind: MoneyBlockKind } } =>
      (kinds as readonly string[]).includes(item.source.kind),
    )
    .map((item) => ({
      id: realIdOf(item.source),
      name: item.label,
      value: item.amount as Cents,
      entity: item.entity,
      kind: item.source.kind,
    }))
}

function toSingleItemBlock(item: RawBlockItem): MoneyBlockSelection {
  return { id: item.id, name: item.name, value: item.value, kind: item.kind, items: [item] }
}

// files_design/01 §13: "mostra a composição do valor (ex.: Investimentos =
// Tesouro Direto + Ações XP)" — o Wireframe (docs/figma/frames/5-2, nó
// 189:2-8: um único bloco "Investimentos", legenda "Tesouro, ações") desenha
// isso como UM bloco de nível 1, nunca um por instrumento.
const INVESTMENTS_BLOCK_ID = 'investimentos'
const INVESTMENTS_BLOCK_NAME = 'Investimentos'

/**
 * P43 (produto, 2026-09-09) — a faixa de Dívidas é UM bloco, como Investimentos.
 *
 * Medido na `Faixa - Dívidas` do Mockup "Desktop — Início dashboard": há um
 * bloco só, com legenda "Financiamento, cartão" — dois instrumentos — sob um
 * valor único, e o rótulo "Dívidas (Passivos)" cobre a faixa inteira (420 de
 * largura). É a mesma construção de "Investimentos / Tesouro, ações", que já
 * era agregada; a faixa de baixo é que estava divergindo da de cima, dentro do
 * mesmo card.
 */
const LIABILITIES_BLOCK_ID = 'liabilities'
const LIABILITIES_BLOCK_NAME = 'Dívidas (Passivos)'

/** As dívidas somadas num bloco só; a composição vive no modal, como em Investimentos. */
export function liabilityBlocksFrom(sheet: BalanceSheet): MoneyBlockSelection[] {
  const items = itemsOfKind(sheet, ['Liability'])
  if (items.length === 0) return []
  return [
    {
      id: LIABILITIES_BLOCK_ID,
      name: LIABILITIES_BLOCK_NAME,
      value: add(...items.map((item) => item.value)),
      kind: 'Liability',
      items,
    },
  ]
}

/**
 * Blocos de Ativos de "Onde Está Meu Dinheiro": cada Conta Bancária continua
 * seu próprio bloco (docs/figma/frames/345-252, nós 347:418 "Nubank (PF)" e
 * 347:425 "Itaú PJ", cada um separado), mas todo Investimento entra agregado
 * num único bloco "Investimentos" cuja Composição (modal) lista cada
 * instrumento. Exportado (em vez de ficar só dentro do componente) porque é
 * a regra que o teste deste arquivo protege sem precisar montar o React.
 */
export function assetBlocksFrom(sheet: BalanceSheet): MoneyBlockSelection[] {
  const bankAccountBlocks = itemsOfKind(sheet, ['BankAccount']).map(toSingleItemBlock)
  const investmentItems = itemsOfKind(sheet, ['Investment'])
  if (investmentItems.length === 0) return bankAccountBlocks

  const investmentsBlock: MoneyBlockSelection = {
    id: INVESTMENTS_BLOCK_ID,
    name: INVESTMENTS_BLOCK_NAME,
    value: add(...investmentItems.map((item) => item.value)),
    kind: 'Investment',
    items: investmentItems,
  }
  return [...bankAccountBlocks, investmentsBlock]
}

/**
 * Onde Está Meu Dinheiro — files_design/08 §2.3 (faixas de ativos/dívidas). No dedicated report
 * exists for this card either: it reads the SAME per-account/per-investment/
 * per-passivo items the Balanço Patrimonial already computes (`outstandingBalance`
 * for a Liability included), filtered down to what is líquido — Bens Materiais
 * are explicitly excluded (PRD §1) — instead of re-deriving account balances
 * or an amortisation schedule on the client.
 */
export function MoneyMapCard() {
  const [today] = React.useState(todayIsoDate)
  const { data, isPending, isError } = useMoneyMap(today)
  const [selectedBlock, setSelectedBlock] = React.useState<MoneyBlockSelection | null>(null)

  const { assets, liabilities, netWorth } = React.useMemo(() => {
    if (!data) return { assets: [], liabilities: [], netWorth: 0 as Cents }
    const assetItems = assetBlocksFrom(data)
    const liabilityItems = liabilityBlocksFrom(data)
    const totalAssets = add(...assetItems.map((item) => item.value))
    const totalLiabilities = add(...liabilityItems.map((item) => item.value))
    return {
      assets: assetItems,
      liabilities: liabilityItems,
      netWorth: subtract(totalAssets, totalLiabilities),
    }
  }, [data])

  // files_design/08 §2.3: `largura_dividas = largura_ativos * (total_dividas /
  // total_ativos)`, limitada à largura da faixa de ativos. Expressa como razão
  // porque a largura em pixels só é conhecida pelo <Treemap>, que a mede.
  const liabilitiesWidthRatio = React.useMemo(() => {
    const totalAssets = add(...assets.map((item) => item.value))
    const totalLiabilities = add(...liabilities.map((item) => item.value))
    if (totalAssets <= 0) return 1
    return Math.min(1, totalLiabilities / totalAssets)
  }, [assets, liabilities])

  const empty = !isPending && !isError && assets.length === 0 && liabilities.length === 0

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex flex-col gap-4">
          <CardTitle>Onde Está Meu Dinheiro</CardTitle>
          <CardCaption>
            Clique num bloco pra redirecionar dinheiro pra outro lugar, a qualquer momento.
          </CardCaption>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-16">
        {isPending ? (
          <Loading bars={SKELETON_BARS.ONDE_ESTA_MEU_DINHEIRO} />
        ) : isError ? (
          <p className="text-style-body-sm text-ink-secondary">
            Não foi possível carregar Onde Está Meu Dinheiro agora.
          </p>
        ) : empty ? (
          // Frame 310:2 ("Vazio — Home") desenha o botão "Cadastrar agora"
          // aqui, e a própria mensagem nomeia o destino ("...em Plano de
          // Contas e Patrimônio"). Sem `actionHref` o <Empty> o omitia.
          <Empty copy={EMPTY_STATES.ONDE_ESTA_MEU_DINHEIRO} actionHref="/plano-de-contas" />
        ) : (
          <>
            <section className="flex flex-col gap-8">
              {/* "O que você tem", não "Ativos" — Figma "Desktop — Início
                  dashboard", nó `Rótulo de seção` (label.xs) acima da faixa.
                  "Ativos" é o nome da CAMADA que agrupa a faixa
                  ("Faixa - Ativos"), não o texto desenhado; foi nome de camada
                  que virou texto de tela. O par de rótulos é deliberadamente
                  sem jargão contábil, igual ao "O que você deve" abaixo. */}
              <h3 className="text-style-label-xs text-ink-secondary">O que você tem</h3>
              <Treemap
                items={assets}
                height={ASSETS_HEIGHT}
                variant="filled"
                onSelect={(item) =>
                  setSelectedBlock(assets.find((block) => block.id === item.id) ?? null)
                }
              />
            </section>
            {liabilities.length > 0 ? (
              <section className="flex flex-col gap-8">
                {/* "O que você deve" é o `Rótulo de seção`; "Dívidas
                    (Passivos)" existe no frame, mas dentro da faixa
                    (`Faixa - Dívidas`), como legenda do bloco — não é o título
                    da seção. */}
                <h3 className="text-style-label-xs text-ink-secondary">O que você deve</h3>
                <Treemap
                  items={liabilities}
                  height={LIABILITIES_HEIGHT}
                  widthRatio={liabilitiesWidthRatio}
                  minWidth={LIABILITIES_MIN_WIDTH}
                  variant="outlined"
                  onSelect={(item) =>
                    setSelectedBlock(liabilities.find((block) => block.id === item.id) ?? null)
                  }
                />
              </section>
            ) : null}
            <p className="text-style-body-sm text-ink-secondary">
              Bens Materiais não entram aqui, não são dinheiro líquido, só viram isso quando
              vendidos (ver Bens Materiais).
            </p>
            <div className="flex items-center justify-end border-t border-line-default pt-12">
              <span className="text-style-body-md font-medium text-ink-primary">
                Patrimônio Líquido: {formatMoney(netWorth)}
              </span>
            </div>
          </>
        )}
      </CardBody>
      <BlockDetailModal
        block={selectedBlock}
        open={selectedBlock !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedBlock(null)
        }}
      />
    </Card>
  )
}

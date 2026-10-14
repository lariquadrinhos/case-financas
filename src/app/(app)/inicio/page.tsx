'use client'

import * as React from 'react'
import { todayMonth } from '@/lib/today'
import type { Month, View } from '@/domain/core'
import { greetingFor } from '@/lib/greeting'
import { useCategories } from './_lib/queries'
import {
  HomeLayoutProvider,
  HomeCardShell,
  HomeHeading,
  OrganizeHomeButton,
  useHomeCardOrder,
} from './_components/home-layout'
import { PendingItemsCard } from './_components/pending-items-card'
import { CashFlowCard } from './_components/cash-flow-card'
import { MoneyMapCard } from './_components/money-map-card'
import { ExpensesByCategoryCard } from './_components/expenses-by-category-card'
import { DiscretionarySpendingCard } from './_components/discretionary-spending-card'
import { RecentEventsCard } from './_components/recent-events-card'

/**
 * Home (Dashboard) — files_design/01 §4. Order from the PRD §"Home (novo na
 * v7)": Pendências, Entradas e Saídas, Onde Está Meu Dinheiro, Despesas por
 * Categoria, Consumo Livre, Eventos Recentes — the default `Organizar Home`
 * layout, overridable per person (`HomeLayoutProvider`).
 */
/**
 * Título e legenda de cada card, PALAVRA POR PALAVRA iguais aos que o próprio
 * card renderiza (e ao frame 5:2 do Figma). São o que a linha fina do card
 * minimizado mostra — files_design/01 §4a: "aparece como uma linha fina
 * (título + legenda + botão Maximizar)". Um resumo próprio aqui fazia o mesmo
 * card ter dois nomes na mesma tela, conforme estivesse aberto ou minimizado.
 */
const CARD_META = {
  pendencias: {
    id: 'pendencias',
    title: 'Pendências',
    caption:
      'Coisas que precisam da sua decisão: valor sem destino, recorrência sem valor definido, ou lucro do mês ainda não distribuído.',
  },
  'entradas-e-saidas': {
    id: 'entradas-e-saidas',
    title: 'Entradas e Saídas',
    caption:
      'De onde vem e pra onde vai o dinheiro no mês selecionado. Mês atual ou passado mostra fato; mês futuro mostra projeção.',
  },
  'onde-esta-meu-dinheiro': {
    id: 'onde-esta-meu-dinheiro',
    title: 'Onde Está Meu Dinheiro',
    caption: 'Clique num bloco pra redirecionar dinheiro pra outro lugar, a qualquer momento.',
  },
  'despesas-por-categoria': {
    id: 'despesas-por-categoria',
    title: 'Despesas por Categoria',
    caption: 'Clique na categoria para visualizar ou adicionar gastos.',
  },
  'consumo-livre': {
    id: 'consumo-livre',
    title: 'Saldo para Consumo Livre',
    caption: 'Seu limite livre do mês, sem precisar lançar cada gasto.',
  },
  'eventos-recentes': {
    id: 'eventos-recentes',
    title: 'Eventos Recentes',
    caption: 'Últimos 5: reajustes, divergências e parcelas confirmadas',
  },
} as const

const DEFAULT_ORDER = Object.keys(CARD_META)

export default function HomePage() {
  // "Hoje" só existe no dispositivo, nunca no servidor — a mesma regra que
  // `dre/page.tsx` já seguia, e que esta página violava em dois pontos.
  //
  // MEDIDO em 2026-09-12, subindo o servidor em Asia/Tokyo com o navegador no
  // fuso local: o HTML do servidor vinha com "Boa noite" e o cliente
  // renderizava "Boa tarde". É o hydration mismatch que o React relata — e não
  // precisa de fuso diferente para acontecer, basta o HTML do servidor ser
  // reaproveitado depois de o relógio cruzar a fronteira de uma saudação (ou
  // de um mês).
  //
  // Resolvidos DEPOIS do mount, uma vez: assim o HTML do servidor e o primeiro
  // render do cliente sempre concordam.
  const [month, setMonth] = React.useState<Month | null>(null)
  const [view, setView] = React.useState<View>('Consolidated')
  const [greeting, setGreeting] = React.useState('')
  const categories = useCategories()

  React.useEffect(() => {
    setMonth(todayMonth())
    setGreeting(greetingFor(new Date().getHours()))
    // Roda uma vez, no mount, de propósito — ver o comentário acima.
  }, [])

  // Os cards que dependem do mês só entram quando ele é conhecido. Na prática
  // isso custa um frame: eles são movidos por TanStack Query, que não roda no
  // servidor, então o que o SSR produzia para eles já era o estado de carga.
  const cards: Record<string, React.ReactNode> = {
    pendencias: <PendingItemsCard categories={categories.data?.data} />,
    'entradas-e-saidas':
      month === null ? null : (
        <CashFlowCard month={month} view={view} onMonthChange={setMonth} onViewChange={setView} />
      ),
    'onde-esta-meu-dinheiro': <MoneyMapCard />,
    'despesas-por-categoria': month === null ? null : <ExpensesByCategoryCard month={month} />,
    'consumo-livre': month === null ? null : <DiscretionarySpendingCard month={month} />,
    'eventos-recentes': <RecentEventsCard />,
  }

  return (
    <HomeLayoutProvider defaultOrder={DEFAULT_ORDER}>
      <div className="flex flex-col gap-24">
        <div className="flex items-center justify-between gap-16">
          <HomeHeading greeting={greeting} />
          <OrganizeHomeButton />
        </div>
        <HomeCardList cards={cards} />
      </div>
    </HomeLayoutProvider>
  )
}

function HomeCardList({ cards }: { cards: Record<string, React.ReactNode> }) {
  const order = useHomeCardOrder()
  return (
    <>
      {order.map((id) => {
        const meta = CARD_META[id as keyof typeof CARD_META]
        const content = cards[id]
        if (!meta || !content) return null
        return (
          <HomeCardShell key={id} meta={meta}>
            {content}
          </HomeCardShell>
        )
      })}
    </>
  )
}

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { cents } from '@/domain/core'
import { MoneyMapCard } from './money-map-card'
import type { BalanceSheet } from '../_lib/queries'

/**
 * Auditoria cruzada Figma ↔ código de 2026-09-08. Os rótulos das duas faixas
 * do "Onde Está Meu Dinheiro" vinham do NOME DA CAMADA do Figma, não do texto
 * desenhado. Medido nó a nó no Mockup "Desktop — Início dashboard (claro)":
 *
 *   `Rótulo de seção` (label.xs), acima da faixa de cima     → "O que você tem"
 *   `Rótulo de seção` (label.xs), acima da faixa de baixo    → "O que você deve"
 *
 * O código escrevia "Ativos" no primeiro — que é o nome da camada que agrupa a
 * faixa (`Faixa - Ativos`), invisível para quem usa — e "Dívidas (Passivos)"
 * no segundo, que existe no frame mas DENTRO da faixa (`Faixa - Dívidas`),
 * como legenda do bloco, não como título da seção.
 *
 * O par desenhado é deliberadamente sem jargão contábil, e é o tipo de escolha
 * que files_design/04 existe para proteger: "Ativos" e "Passivos" dizem a
 * mesma coisa para um contador e coisa nenhuma para o resto do mundo.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const balanceSheet: BalanceSheet = {
  view: 'Consolidated',
  asOf: '2026-07-20',
  currentAssets: {
    total: cents(179_600_00),
    items: [
      {
        source: { kind: 'BankAccount', bankAccountId: 'acc-nubank' },
        entity: 'PF',
        label: 'Nubank',
        amount: cents(179_600_00),
      },
    ],
  },
  nonCurrentAssets: {
    total: cents(150_000_00),
    items: [
      {
        source: { kind: 'Investment', investmentId: 'inv-tesouro' },
        entity: 'PF',
        label: 'Tesouro Direto',
        amount: cents(150_000_00),
      },
    ],
  },
  currentLiabilities: { total: cents(0), items: [] },
  nonCurrentLiabilities: {
    total: cents(24_000_00),
    items: [
      {
        source: { kind: 'Liability', liabilityId: 'lia-financiamento' },
        entity: 'PF',
        label: 'Financiamento apartamento',
        amount: cents(24_000_00),
      },
    ],
  },
  totalAssets: cents(329_600_00),
  totalLiabilities: cents(24_000_00),
  netWorth: cents(305_600_00),
}

vi.mock('../_lib/queries', async (original) => ({
  ...(await original<typeof import('../_lib/queries')>()),
  useMoneyMap: () => ({ data: balanceSheet, isPending: false, isError: false }),
}))

describe('Onde Está Meu Dinheiro — rótulos das faixas (Mockup "Desktop — Início dashboard")', () => {
  it('a faixa de cima se chama "O que você tem", não "Ativos"', () => {
    render(<MoneyMapCard />)

    expect(screen.getByRole('heading', { name: 'O que você tem' })).toBeInTheDocument()
    expect(screen.queryByText('Ativos')).not.toBeInTheDocument()
  })

  it('a faixa de baixo se chama "O que você deve"', () => {
    render(<MoneyMapCard />)

    expect(screen.getByRole('heading', { name: 'O que você deve' })).toBeInTheDocument()
  })
})

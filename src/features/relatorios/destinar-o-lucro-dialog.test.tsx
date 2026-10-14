import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cents, month } from '@/domain/core'
import type { ProfitAllocation } from '@/domain/profit-allocation'
import { DestinarOLucroDialog } from './destinar-o-lucro-dialog'

/**
 * files_design/01 §9: "Cada item também mostra sua própria % do lucro, ao
 * lado do valor" — além do subtotal do card. Figma Wireframe 27:2 desenha o
 * badge em CADA item (nodes 245:14/15 "24%" ao lado de Tesouro Direto,
 * 245:19/20 "14%" Ações XP, etc.), não só no cabeçalho do card.
 */

vi.mock('./profit-allocation', () => ({
  useProfitAllocationQuery: () => ({ status: 'success', data: allocation }),
  useSaveProfitAllocation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/features/plano-de-contas-e-patrimonio/investments', () => ({
  investments: {
    useList: () => ({
      data: { data: [{ id: 'inv-1', name: 'Tesouro Direto' }] },
    }),
  },
}))

vi.mock('@/features/plano-de-contas-e-patrimonio/bank-accounts', () => ({
  bankAccounts: {
    useList: () => ({ data: { data: [] } }),
  },
}))

const allocation: ProfitAllocation = {
  month: month('2026-07'),
  netProfit: cents(10000),
  items: {
    InvestmentContribution: [
      {
        destination: { kind: 'Investment', investmentId: 'inv-1' as never },
        amount: cents(2400),
      },
    ],
    DividendReinvestment: [],
    ExtraordinaryConsumption: [],
    CashReserve: [],
  },
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <DestinarOLucroDialog
        month={month('2026-07')}
        netProfit={cents(10000)}
        open
        onOpenChange={() => {}}
      />
    </QueryClientProvider>,
  )
}

describe('Destinar o Lucro — item do card mostra a própria % do lucro (files_design/01 §9)', () => {
  it('mostra "24%" ao lado do valor do item Tesouro Direto, não só no subtotal do card', () => {
    renderDialog()

    const row = screen.getByText('Tesouro Direto').closest('li')
    expect(row).not.toBeNull()
    expect(row).toHaveTextContent('24%')
  })
})

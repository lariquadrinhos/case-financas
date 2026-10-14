import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PendingItemsCard } from './pending-items-card'
import type { PendingItem } from '../_lib/queries'

/**
 * files_design/01 §4 / files_design/03 "Pendente de Direcionamento": "Ação
 * 'Direcionar agora' abre a mesma escolha de conta que aparecia no modal de
 * venda." Medido ao vivo (http://localhost:3098): o botão era um
 * `<Link href="/bens-materiais">` puro — depois que um bem é vendido ele some
 * dessa lista (files_design/01 §11), então a página pra onde o link manda não
 * tem mais nenhum jeito de reabrir a escolha de destino daquele valor. O
 * endpoint que resolve a Pendência (`POST /pending-allocations/{id}/
 * allocations`) sempre existiu no backend — só não tinha chamador nenhum na UI.
 */
function makePendingAssetSaleItem(): PendingItem {
  return {
    kind: 'AssetSaleAllocation',
    date: '2026-07-12',
    amount: 480000,
    item: {
      id: 'pending-1',
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: 'asset-1' },
      amount: 480000,
      originDate: '2026-07-12',
      status: 'Pending',
    },
  }
}

function renderCard() {
  const client = new QueryClient({
    // `staleTime: Infinity` keeps the seeded cache from being clobbered by a
    // background refetch hitting a real, non-existent server in jsdom — this
    // test is about what "Direcionar agora" does, not about query fetching.
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  client.setQueryData(['pending-items'], {
    data: [makePendingAssetSaleItem()],
    meta: { total: 1 },
  })
  client.setQueryData(['tangible-assets', 'asset-1'], { name: 'Civic Teste 2020' })

  return render(
    <QueryClientProvider client={client}>
      <PendingItemsCard categories={[]} />
    </QueryClientProvider>,
  )
}

describe('Pendências — "Direcionar agora" (files_design/03 "Pendente de Direcionamento")', () => {
  it('não é mais um link estático para /bens-materiais', async () => {
    renderCard()

    const action = await screen.findByRole('button', { name: 'Direcionar agora' })
    // Um `<Button asChild><Link .../></Button>` também expõe role "button" no
    // testing-library — a prova real de que não é mais navegação é a AUSÊNCIA
    // de um href apontando pra uma tela que não sabe resolver a pendência.
    expect(action.closest('a')).toBeNull()
  })

  it('abre o modal "Direcionar valor" com a mesma escolha de conta do modal de venda', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(await screen.findByRole('button', { name: 'Direcionar agora' }))

    const dialog = await screen.findByRole('dialog', { name: 'Direcionar valor' })
    expect(within(dialog).getByText(/Venda de Civic Teste 2020/)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: '+ Adicionar Direcionamento' }),
    ).toBeInTheDocument()
  })
})

/**
 * Figma Wireframe `115:19` (docs/figma/frames/5-2__desktop-inicio-dashboard.xml)
 * e Mockup `549:93` (canvas 552:2) escrevem, os dois, o MESMO literal:
 * "R$ 3.000,00 do lucro de Julho não alocado". O mês por extenso é o único
 * identificador que o card de lucro carrega — o desenho não tem data em
 * nenhum dos quatro tipos de Pendência (115:2, 549:75, 309:2, 309:26).
 */
function makeUnallocatedProfitItem(month: string, amount: number): PendingItem {
  return {
    kind: 'UnallocatedProfit',
    date: `${month}-01`,
    amount,
    item: { kind: 'UnallocatedProfit', month, amount },
  } as PendingItem
}

function renderWithItems(items: readonly PendingItem[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(['pending-items'], { data: items, meta: { total: items.length } })

  return render(
    <QueryClientProvider client={client}>
      <PendingItemsCard categories={[]} />
    </QueryClientProvider>,
  )
}

describe('Pendências — lucro não alocado (Figma 115:19 / 549:93)', () => {
  it('escreve o mês por extenso no título, palavra por palavra igual ao frame', async () => {
    renderWithItems([makeUnallocatedProfitItem('2026-07', 300000)])

    expect(await screen.findByText('R$ 3.000,00 do lucro de Julho não alocado')).toBeInTheDocument()
  })

  it('distingue dois meses em aberto na mesma Home', async () => {
    renderWithItems([
      makeUnallocatedProfitItem('2026-06', 100000),
      makeUnallocatedProfitItem('2026-07', 300000),
    ])

    expect(await screen.findByText('R$ 1.000,00 do lucro de Junho não alocado')).toBeInTheDocument()
    expect(await screen.findByText('R$ 3.000,00 do lucro de Julho não alocado')).toBeInTheDocument()
  })
})

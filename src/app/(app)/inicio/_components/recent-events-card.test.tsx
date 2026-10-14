import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

/**
 * A coluna de data de Eventos Recentes NÃO é o rótulo do seletor de mês, e não
 * pode pendurar-se no mesmo token que ele.
 *
 * Medido agora via MCP na página Mockup (552:2), linha `549:280` do card
 * "Eventos Recentes" (`549:278`): a linha mede 1040×42 e traz a data
 * `549:281` "20/07/2026" em x=16 **w=71**, com a descrição `549:282`
 * começando em x=103 — ou seja 16 de padding, a data, e 16 de respiro. As
 * outras quatro linhas repetem o padrão com a data em 69 (`549:284`
 * "10/07/2026") e 73 (`549:287` "05/06/2026"), sempre com exatamente 16 até a
 * descrição. A data mais larga que o frame desenha é 73px.
 *
 * Defeito medido antes da correção: a coluna usava
 * `w-[var(--width-month-label)]` — o token do rótulo "Julho 2026" do seletor
 * de mês, cuja medida vem de outro componente (Mockup 398:22, célula 100×36).
 * Dois significados num token só: corrigir a largura do seletor de mês movia,
 * de carona, a coluna de data deste card.
 */
vi.mock('../_lib/queries', () => ({
  useRecentEvents: () => ({
    data: {
      data: [
        {
          id: 'evt-1',
          date: '2026-07-20',
          description: 'Aluguel pago com divergência',
        },
      ],
    },
    isPending: false,
    isError: false,
  }),
}))

const { RecentEventsCard } = await import('./recent-events-card')

describe('Eventos Recentes — coluna de data (Mockup 549:281)', () => {
  afterEach(cleanup)

  it('não reaproveita --width-month-label, que é a célula do rótulo do seletor de mês (398:22)', () => {
    render(<RecentEventsCard />)

    expect(screen.getByText('20/07/2026').className).not.toContain('--width-month-label')
  })

  it('usa o token próprio da coluna, medido na linha 549:280 do card', () => {
    render(<RecentEventsCard />)

    expect(screen.getByText('20/07/2026').className).toContain('--width-event-date')
  })
})

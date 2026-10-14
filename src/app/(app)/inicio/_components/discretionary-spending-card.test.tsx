import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { month } from '@/domain/core'

/**
 * A barra do Consumo Livre, medida contra o nó que a desenha.
 *
 * O DEFEITO que estes testes travam: `--height-progress-track: 8px` não vinha
 * de frame nenhum — o comentário do token dizia "no named Escala token covers a
 * continuous fill bar; 8px keeps it visually in the same family as
 * `scale/space/8`". A premissa era verdadeira e irrelevante: no Figma a altura
 * da barra é valor cru, não variável da coleção Escala, e por isso a medida do
 * frame é a fonte — não a analogia com um token de ESPAÇO.
 *
 * Medido agora por MCP na página Mockup (552:2), wrapper `549:110` do card
 * "Saldo para Consumo Livre": 683×61 = texto `549:111` (26) + gap 4 + trilho
 * `549:112` (683×31), com o preenchimento `549:113` em 350×31. `rounded-[5px]`
 * no trilho E no preenchimento; o valor "R$ 350 / R$ 500" em numeric.lg sobre
 * `--texto-secundario`. O Wireframe local concorda em oito frames: 347:719 /
 * 347:720 em 345-752, e os pares idênticos de 5-2, 317-5, 345-2, 345-252,
 * 345-502, 345-1002 e 349-2 — todos 683×31.
 *
 * Quatro divergências, todas contra o mesmo nó: altura 8 contra 31 (~4×), raio
 * `--radius-pill` (999) contra 5 — com 8 de altura a pill vira um semicírculo,
 * uma FORMA diferente e não só uma altura —, gap 8 contra 4, e o valor em
 * `text-ink-primary` contra `--texto-secundario`.
 */
vi.mock('../_lib/queries', () => ({
  useLeftoverDirections: () => ({ data: { data: [] } }),
  useDiscretionarySpendingConfig: () => ({
    data: { id: 'cfg-1', monthlyAmount: 50_000, sourceAccountId: 'acc-1' },
    isPending: false,
  }),
  useDiscretionaryExpenses: () => ({
    data: { data: [{ id: 'exp-1', amount: 35_000, month: '2026-07' }] },
    isPending: false,
  }),
  useBankAccounts: () => ({
    data: { data: [{ id: 'acc-1', label: 'Nubank', entity: 'PF' }] },
    isPending: false,
  }),
  useInvestments: () => ({ data: { data: [] }, isPending: false }),
}))

const { DiscretionarySpendingCard } = await import('./discretionary-spending-card')

const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

/**
 * O jsdom não carrega o Tailwind, então `getComputedStyle().height` devolve
 * vazio para uma classe utilitária: a testemunha disponível é a classe que o
 * componente pôs no elemento, e o valor por trás dela é conferido no mesmo
 * arquivo, contra tokens.css. É por isso que o teste casa token E valor.
 */
function expectToken(token: string, value: number) {
  expect(tokensCss).toMatch(new RegExp(`${token}:\\s*${value}px;`))
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <DiscretionarySpendingCard month={month('2026-07')} />
    </QueryClientProvider>,
  )
  const track = document.querySelector('.bg-surface-subtle')
  const fill = document.querySelector('.bg-surface-inverse')
  if (track === null || fill === null) throw new Error('trilho ou preenchimento ausente no DOM')
  return { track, fill }
}

describe('Consumo Livre — barra de progresso (Mockup 549:112)', () => {
  afterEach(cleanup)

  it('o trilho tem a altura do frame 549:112, não a analogia com scale/space/8', () => {
    const { track } = renderCard()

    expect(track.className).toContain('h-[var(--height-progress-track)]')
    expectToken('--height-progress-track', 31)
  })

  it('trilho e preenchimento usam o raio 5 de 549:112/549:113, nunca --radius-pill', () => {
    const { track, fill } = renderCard()

    expect(track.className).not.toContain('rounded-pill')
    expect(fill.className).not.toContain('rounded-pill')
    expect(track.className).toContain('rounded-progress-track')
    expect(fill.className).toContain('rounded-progress-track')
    expectToken('--radius-progress-track', 5)
  })

  it('o wrapper 549:110 separa valor e trilho por --espaco-4, não por 8', () => {
    const { track } = renderCard()
    const wrapper = track.parentElement
    if (wrapper === null) throw new Error('wrapper do trilho ausente no DOM')

    expect(wrapper.className).toContain('gap-4')
    expect(wrapper.className).not.toContain('gap-8')
  })

  it('o valor "R$ 350 / R$ 500" usa --texto-secundario (549:111), não o texto primário', () => {
    renderCard()
    const value = screen.getByText(/R\$\s?350,00\s?\/\s?R\$\s?500,00/)

    expect(value.className).toContain('text-ink-secondary')
    expect(value.className).not.toContain('text-ink-primary')
  })
})

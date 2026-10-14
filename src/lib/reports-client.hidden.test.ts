import { describe, expect, it, vi } from 'vitest'

/**
 * O caminho que a tela do DRE usa, com o `parse` de verdade (relato de
 * 2026-10-01: o olhinho nunca fechava porque a marca `hidden` morria aqui).
 * Os testes da tela simulam `fetchIncomeStatement` inteiro e não pegavam isso.
 */
vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(async () => ({
    month: '2026-10',
    view: 'PF',
    statusFilter: 'Planned',
    forecast: false,
    grossProfit: 0,
    netProfit: 0,
    lines: [
      {
        kind: 'block',
        key: 'bloco-1',
        label: 'Bloco sintético',
        amount: 0,
        level: 0,
        breakdown: [{ key: 'category:a', label: 'Categoria A', amount: 100, hidden: true }],
      },
    ],
    rows: [
      {
        source: { kind: 'Entry', entryId: 'e1' },
        name: 'Lançamento sintético',
        entity: 'PF',
        categoryId: 'a',
        blockId: 'bloco-1',
        blockName: 'Bloco sintético',
        status: 'Planned',
        amount: 100,
        hidden: true,
      },
    ],
  })),
}))

describe('fetchIncomeStatement — a simulação chega à tela', () => {
  it('a linha e o item do bloco ocultos chegam marcados', async () => {
    const { fetchIncomeStatement } = await import('./reports-client')
    const statement = await fetchIncomeStatement({
      month: '2026-10',
      view: 'PF',
      statusFilter: 'Planned',
      hidden: 'entry:e1',
    })
    expect(statement.rows[0]?.hidden).toBe(true)
    const line = statement.lines[0]
    expect(line?.kind === 'block' && line.breakdown[0]?.hidden).toBe(true)
  })
})

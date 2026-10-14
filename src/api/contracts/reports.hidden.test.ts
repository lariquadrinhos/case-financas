import { describe, expect, it } from 'vitest'
import { incomeStatementSchema } from './reports'

/**
 * Relato de 2026-10-01: "não tá fechando" — o olhinho do DRE nunca mudava para
 * fechado. Medido: o servidor devolvia `hidden: true`, mas o cliente valida a
 * resposta com este schema (`reports-client.ts`, `schema.parse`), e o Zod
 * descartava o campo que não conhecia. A tela nunca soube o que estava oculto.
 */
describe('incomeStatementSchema — a marca de oculto sobrevive ao parse', () => {
  const payload = {
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
  }

  it('a linha mantém `hidden`', () => {
    const parsed = incomeStatementSchema.parse(payload)
    expect(parsed.rows[0]).toMatchObject({ hidden: true })
  })

  it('o item do detalhamento do bloco mantém `hidden`', () => {
    const parsed = incomeStatementSchema.parse(payload)
    const line = parsed.lines[0] as { breakdown: { hidden?: boolean }[] }
    expect(line.breakdown[0]).toMatchObject({ hidden: true })
  })

  it('2026-10-01 — a linha mantém `amountToBeDefined` (mês "a definir" em branco)', () => {
    const parsed = incomeStatementSchema.parse({
      ...payload,
      rows: [{ ...payload.rows[0], amount: 0, amountToBeDefined: true }],
    })
    expect(parsed.rows[0]).toMatchObject({ amountToBeDefined: true })
  })

  it('2026-10-01 — a linha mantém `flow` (entrada ou saída)', () => {
    const parsed = incomeStatementSchema.parse({
      ...payload,
      rows: [{ ...payload.rows[0], flow: 'Out' }],
    })
    expect(parsed.rows[0]).toMatchObject({ flow: 'Out' })
  })
})

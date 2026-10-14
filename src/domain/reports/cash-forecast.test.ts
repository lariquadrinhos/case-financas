import { describe, expect, it } from 'vitest'
import { asId, cents, type BankAccountId } from '@/domain/core'
import { cashBridge, cashForecast } from './cash-forecast'
import type { IncomeStatementRow } from './types'

/**
 * "Caixa do mês" (dono, 2026-10-09: "o DRE não está contabilizando meu saldo em
 * conta atual"). Fora da cascata: o DRE é resultado, o saldo é patrimônio
 * (PRD §5, "planos distintos"). Dados sintéticos.
 */

const PF = asId<BankAccountId>('conta-pf')
const PF2 = asId<BankAccountId>('conta-pf-2')
const PJ = asId<BankAccountId>('conta-pj')
const accounts = [
  { id: PF, label: 'Banco A', entity: 'PF' as const, balance: cents(1_000_00) },
  { id: PF2, label: 'Banco B', entity: 'PF' as const, balance: cents(500_00) },
  { id: PJ, label: 'Banco C', entity: 'PJ' as const, balance: cents(2_000_00) },
]

function row(status: 'Paid' | 'Planned', flow: 'In' | 'Out', amount: number): IncomeStatementRow {
  return {
    source: { kind: 'Entry', entryId: asId(`e-${status}-${flow}-${amount}`) },
    name: 'Sintético',
    entity: 'PF',
    categoryId: null,
    blockId: asId('b'),
    blockName: 'B',
    status,
    amount: cents(amount),
    flow,
  } as IncomeStatementRow
}

describe('cashForecast', () => {
  it('dono 2026-10-09 — saldo previsto = saldo de hoje + o que ainda está previsto; o pago já está no saldo', () => {
    const forecast = cashForecast({
      accounts,
      view: 'Consolidated',
      rows: [
        row('Paid', 'Out', 300_00),
        row('Planned', 'In', 200_00),
        row('Planned', 'Out', 50_00),
      ],
      hidden: new Set(),
    })
    expect(forecast.balanceToday).toBe(3_500_00)
    expect(forecast.stillPlanned).toBe(150_00)
    expect(forecast.endOfMonth).toBe(3_650_00)
  })

  it('dono 2026-10-09 — a conta oculta sai do saldo de hoje e continua listada', () => {
    const forecast = cashForecast({
      accounts,
      view: 'Consolidated',
      rows: [],
      hidden: new Set([PJ]),
    })
    expect(forecast.balanceToday).toBe(1_500_00)
    expect(forecast.accounts.find((a) => a.id === PJ)?.hidden).toBe(true)
  })

  it('dono 2026-10-09 — na visão PF, só as contas da PF', () => {
    const forecast = cashForecast({ accounts, view: 'PF', rows: [], hidden: new Set() })
    expect(forecast.accounts.map((a) => a.id)).toEqual([PF, PF2])
    expect(forecast.balanceToday).toBe(1_500_00)
  })
})

describe('cashBridge — do início ao fim do mês (dono, 2026-10-09)', () => {
  it('dono 2026-10-09 — início + Lucro Líquido + fora do DRE = saldo previsto no fim', () => {
    const forecast = cashForecast({
      accounts,
      view: 'Consolidated',
      rows: [row('Planned', 'In', 200_00), row('Planned', 'Out', 50_00)],
      hidden: new Set(),
    })
    const bridge = cashBridge(forecast, {
      // O extrato do mês moveu +400 no Banco A; os outros não têm extrato.
      monthMovement: new Map([[PF, cents(400_00)]]),
      netProfit: cents(600_00),
    })
    expect(bridge.balanceAtStart).toBe(3_100_00)
    expect(bridge.netProfit).toBe(600_00)
    // 3.650 (fim) − 3.100 (início) − 600 (lucro) = −50: o que saiu e não é resultado.
    expect(bridge.outsideResult).toBe(-50_00)
    expect(bridge.balanceAtStart + bridge.netProfit + bridge.outsideResult).toBe(
      forecast.endOfMonth,
    )
  })

  it('dono 2026-10-09 — a conta oculta sai também do início do mês', () => {
    const forecast = cashForecast({
      accounts,
      view: 'Consolidated',
      rows: [],
      hidden: new Set([PF]),
    })
    const bridge = cashBridge(forecast, {
      monthMovement: new Map([[PF, cents(400_00)]]),
      netProfit: cents(0),
    })
    expect(bridge.balanceAtStart).toBe(2_500_00)
  })
})

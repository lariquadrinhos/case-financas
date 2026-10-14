import { describe, expect, it } from 'vitest'
import { DISCRETIONARY_CATEGORY_ID } from '@/domain/chart-of-accounts'
import { asId, cents, isoDate, month, ZERO } from '@/domain/core'
import type { BankAccountId, Cents, EntryId, LeftoverDirectionId } from '@/domain/core'
import type { LeftoverDirection } from './types'
import {
  allowanceForMonth,
  assertValidExpenseAmount,
  buildExpenseEntry,
  canRedirectRemaining,
  isOverLimit,
  leftoverOfMonth,
  progressFraction,
  remainingBalance,
  totalSpent,
  pendingLeftover,
  leftoverBroughtForward,
  assertDirectionFits,
  monthLimit,
  hasLeftover,
} from './rules'
import type { DiscretionaryExpense, DiscretionarySpendingConfig } from './types'

const SOURCE_ACCOUNT = asId<BankAccountId>('conta-nubank-pf')

const CONFIG: DiscretionarySpendingConfig = {
  monthlyAmount: cents(50_000),
  sourceAccountId: SOURCE_ACCOUNT,
  entity: 'PF',
}

let sequence = 0
function expense(amount: Cents, label: string | null = null): DiscretionaryExpense {
  sequence += 1
  return { id: asId<EntryId>(`gasto-${sequence}`), date: isoDate('2026-07-10'), amount, label }
}

describe('totalSpent — files_design/01 §4a, the widget history', () => {
  it('sums the gastos of the month', () => {
    expect(totalSpent([expense(cents(1_000)), expense(cents(2_500))])).toBe(3_500)
  })

  it('is zero for an empty history, not an error', () => {
    expect(totalSpent([])).toBe(ZERO)
  })
})

describe('allowanceForMonth — verba mensal + sobra do mês anterior (files_design/01 §4a)', () => {
  it('adds the previous leftover to the monthly amount', () => {
    expect(allowanceForMonth(CONFIG, cents(3_000))).toBe(53_000)
  })

  it('is just the monthly amount when there was no leftover', () => {
    expect(allowanceForMonth(CONFIG, ZERO)).toBe(50_000)
  })
})

describe('remainingBalance — "saldo restante" a redirecionar (files_design/01 §4a)', () => {
  it('is the allowance minus what was spent', () => {
    expect(remainingBalance(CONFIG, ZERO, cents(20_000))).toBe(30_000)
  })

  it('goes negative when the month overspent, instead of clamping to zero', () => {
    // isOverLimit reads this same overshoot; clamping here would hide it.
    expect(remainingBalance(CONFIG, ZERO, cents(60_000))).toBe(-10_000)
  })
})

describe('canRedirectRemaining — only a positive leftover can be sent anywhere', () => {
  it('allows a positive remaining balance', () => {
    expect(canRedirectRemaining(cents(1_000))).toBe(true)
  })

  it('refuses zero and a negative balance', () => {
    expect(canRedirectRemaining(ZERO)).toBe(false)
    expect(canRedirectRemaining(cents(-500) as Cents)).toBe(false)
  })
})

describe('progressFraction — files_design/08 §9.2, the bar fills to 100% and stops', () => {
  it('is proportional under the limit', () => {
    expect(progressFraction(cents(35_000), cents(50_000))).toBeCloseTo(0.7)
  })

  it('caps at 1 when spending exceeds the limit — the bar never overflows visually', () => {
    expect(progressFraction(cents(80_000), cents(50_000))).toBe(1)
  })

  it('is zero for no spend against no allowance, never NaN', () => {
    expect(progressFraction(ZERO, ZERO)).toBe(0)
  })

  it('is full for any spend against zero allowance, never Infinity', () => {
    expect(progressFraction(cents(100), ZERO)).toBe(1)
  })
})

describe('isOverLimit — files_design/08 §9.2, "gasto ultrapassa o limite"', () => {
  it('is true once spending passes the limit', () => {
    expect(isOverLimit(cents(50_001), cents(50_000))).toBe(true)
  })

  it('is false exactly at the limit', () => {
    expect(isOverLimit(cents(50_000), cents(50_000))).toBe(false)
  })
})

describe('assertValidExpenseAmount — PRD §1, "nunca negativo"', () => {
  it('accepts zero and positive amounts', () => {
    expect(() => assertValidExpenseAmount(ZERO)).not.toThrow()
    expect(() => assertValidExpenseAmount(cents(1))).not.toThrow()
  })

  it('rejects a negative amount', () => {
    expect(() => assertValidExpenseAmount(cents(-1) as Cents)).toThrow(
      'discretionary_spending.negative_amount',
    )
  })
})

describe('buildExpenseEntry — files_design/03 "Consumo Livre — widget"', () => {
  it('posts to the fixed system category, with the account and entity from the config', () => {
    const entry = buildExpenseEntry(CONFIG, cents(4_500), isoDate('2026-07-12'))
    expect(entry).toEqual({
      kind: 'Expense',
      amount: 4_500,
      date: '2026-07-12',
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: DISCRETIONARY_CATEGORY_ID,
      classification: 'Current',
      bankAccountId: SOURCE_ACCOUNT,
    })
  })

  it('carries the entity configured for the widget, not always PF', () => {
    const pjConfig: DiscretionarySpendingConfig = { ...CONFIG, entity: 'PJ' }
    const entry = buildExpenseEntry(pjConfig, cents(1_000), isoDate('2026-07-12'))
    expect(entry.entity).toBe('PJ')
  })

  it('refuses a negative amount, same rule as assertValidExpenseAmount', () => {
    expect(() => buildExpenseEntry(CONFIG, cents(-1) as Cents, isoDate('2026-07-12'))).toThrow(
      'discretionary_spending.negative_amount',
    )
  })
})

describe('leftoverOfMonth — a sobra do mês anterior (PRD v7 §Consumo Livre, Figma 345:752 nó 192:22)', () => {
  it('files_design/01 §4a — é o que restou da verba do mês que fechou', () => {
    expect(leftoverOfMonth(cents(50_000), cents(35_000))).toBe(15_000)
  })

  it('files_design/02 — sobra nunca vira cobrança: mês estourado passa zero adiante', () => {
    expect(leftoverOfMonth(cents(50_000), cents(62_000))).toBe(ZERO)
  })

  it('é zero quando o mês gastou a verba inteira', () => {
    expect(leftoverOfMonth(cents(50_000), cents(50_000))).toBe(ZERO)
  })
})

/**
 * P14 (produto, 2026-09-08) — a sobra do mês vira PENDÊNCIA, não verba
 * automática.
 *
 * A pergunta ficou aberta porque o frame `345:752` se contradiz: a linha diz
 * "+ Sobra de Junho, **adicionada ao saldo**" e a aritmética diz o contrário.
 * Medido no próprio desenho: verba R$ 500, sobra R$ 150, gastos 50 + 30 + 70 =
 * 150, cabeçalho "R$ 350 de R$ 500". 500 − 150 = 350 fecha; 650 − 150 = 500
 * não. Ou seja, os números desenhados dizem que a sobra NÃO entrou.
 *
 * A decisão resolve os dois lados: a sobra não entra sozinha — vira "valor sem
 * destino" na Home, que é exatamente o que a legenda do card de Pendências
 * sempre prometeu —, e só sobe o teto se a pessoa mandar. O texto da linha é
 * que precisa deixar de prometer o que não cumpre.
 *
 * O que se guarda é o DIRECIONAMENTO, não a pendência: ela continua derivada,
 * o que preserva ADR-0001 §1 e dá o parcelamento de graça.
 */
describe('sobra do mês como Pendência (P14)', () => {
  const JUNHO = month('2026-06')
  const JULHO = month('2026-07')

  function direcao(
    amount: number,
    destino: LeftoverDirection['destination'],
    mes = JUNHO,
  ): LeftoverDirection {
    return {
      id: asId<LeftoverDirectionId>(`dir-${amount}-${destino.kind}`),
      month: mes,
      amount: cents(amount),
      destination: destino,
    }
  }

  it('sem direcionamento nenhum, a pendência é a sobra inteira', () => {
    expect(pendingLeftover(cents(15_000), [], JUNHO)).toBe(15_000)
  })

  it('direcionar parte deixa o resto pendente, como a de venda de bem material', () => {
    const parcial = [direcao(10_000, { kind: 'Discretionary' })]
    expect(pendingLeftover(cents(15_000), parcial, JUNHO)).toBe(5_000)
  })

  it('direcionar tudo zera a pendência — e sem pendência o card some', () => {
    const tudo = [direcao(15_000, { kind: 'Discretionary' })]
    expect(pendingLeftover(cents(15_000), tudo, JUNHO)).toBe(0)
  })

  it('só conta direcionamento do MÊS de origem, não de outro', () => {
    const deJulho = [direcao(15_000, { kind: 'Discretionary' }, JULHO)]
    expect(pendingLeftover(cents(15_000), deJulho, JUNHO)).toBe(15_000)
  })

  it('sobra zero não gera pendência', () => {
    expect(pendingLeftover(cents(0), [], JUNHO)).toBe(0)
  })

  /**
   * O destino é o que decide se o teto sobe. Mandar para uma conta tira o
   * dinheiro do Consumo Livre; mandar de volta para a verba é o único caso em
   * que ele volta a ser gastável no mês.
   */
  it('só o destino Consumo Livre sobe a verba do mês seguinte', () => {
    const paraConta = [direcao(15_000, { kind: 'BankAccount', bankAccountId: asId('acc') })]
    expect(leftoverBroughtForward(paraConta, JUNHO)).toBe(0)

    const paraVerba = [direcao(15_000, { kind: 'Discretionary' })]
    expect(leftoverBroughtForward(paraVerba, JUNHO)).toBe(15_000)
  })

  it('o que volta pra verba entra em allowanceForMonth, e nada mais entra', () => {
    const config: DiscretionarySpendingConfig = {
      monthlyAmount: cents(50_000),
      sourceAccountId: asId('acc'),
      entity: 'PF',
    }
    const paraVerba = [direcao(15_000, { kind: 'Discretionary' })]

    expect(allowanceForMonth(config, leftoverBroughtForward([], JUNHO))).toBe(50_000)
    expect(allowanceForMonth(config, leftoverBroughtForward(paraVerba, JUNHO))).toBe(65_000)
  })

  it('recusa direcionar mais do que ainda resta, e recusa zero', () => {
    expect(() => assertDirectionFits(cents(5_000), cents(5_001))).toThrow(
      'leftover_direction.exceeds_pending',
    )
    expect(() => assertDirectionFits(cents(5_000), cents(0))).toThrow(
      'leftover_direction.non_positive_amount',
    )
    expect(() => assertDirectionFits(cents(5_000), cents(5_000))).not.toThrow()
  })
})

describe('verba: valor fixo ou saldo da conta — decisão do dono, 2026-09-29', () => {
  const base = { sourceAccountId: 'conta' as never, entity: 'PF' as const }

  it('valor fixo: o limite é a verba mais a sobra trazida, como sempre foi', () => {
    const config = { ...base, monthlyAmount: cents(300_000), allowanceKind: 'Fixed' as const }
    expect(
      monthLimit(config, {
        previousLeftover: cents(5_000),
        spent: cents(1_000),
        sourceBalance: cents(99),
      }),
    ).toBe(305_000)
  })

  it('saldo da conta: o limite é o que já saiu mais o que ainda está na conta, e o que resta é o saldo', () => {
    const config = { ...base, monthlyAmount: cents(0), allowanceKind: 'SourceBalance' as const }
    const limite = monthLimit(config, {
      previousLeftover: cents(5_000),
      spent: cents(40_000),
      sourceBalance: cents(160_000),
    })
    expect(limite).toBe(200_000)
    expect(limite - 40_000).toBe(160_000)
  })

  it('saldo da conta não gera sobra a direcionar: o dinheiro continua na conta', () => {
    expect(hasLeftover({ ...base, monthlyAmount: cents(0), allowanceKind: 'SourceBalance' })).toBe(
      false,
    )
    expect(hasLeftover({ ...base, monthlyAmount: cents(1), allowanceKind: 'Fixed' })).toBe(true)
    expect(hasLeftover({ ...base, monthlyAmount: cents(1) })).toBe(true)
  })
})

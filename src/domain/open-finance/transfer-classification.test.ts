import { describe, expect, it } from 'vitest'

import { asId, cents, isoDate, type BankAccountId } from '@/domain/core'
import {
  entryForTransferClassification,
  transferClassificationsFor,
  transferNeedsClassification,
} from './transfer-classification'

const PF = asId<BankAccountId>('conta-pf')
const PJ = asId<BankAccountId>('conta-pj')

describe('transferências entre entidades — decisão do dono, 2026-09-29', () => {
  it('PF→PF e PJ→PJ são automáticas; entre entidades, a pessoa classifica', () => {
    expect(transferNeedsClassification('PF', 'PF')).toBe(false)
    expect(transferNeedsClassification('PJ', 'PJ')).toBe(false)
    expect(transferNeedsClassification('PJ', 'PF')).toBe(true)
    expect(transferNeedsClassification('PF', 'PJ')).toBe(true)
  })

  it('PJ→PF oferece Pró-labore, Distribuição de lucro ou Só transferência; PF→PJ, Aporte na PJ ou Só transferência', () => {
    expect(transferClassificationsFor('PJ', 'PF')).toEqual([
      'ProLabore',
      'ProfitDistribution',
      'Transfer',
    ])
    expect(transferClassificationsFor('PF', 'PJ')).toEqual(['CapitalContribution', 'Transfer'])
  })

  it('PRD §5 — classificar como Pró-labore cria o lançamento intercompany com as duas contas, Pago na data do banco', () => {
    const entry = entryForTransferClassification('ProLabore', {
      amount: cents(500_000),
      date: isoDate('2026-09-05'),
      fromBankAccountId: PJ,
      toBankAccountId: PF,
      description: 'PIX SINTETICO',
    })
    expect(entry).toEqual({
      kind: 'ProLabore',
      amount: 500_000,
      date: '2026-09-05',
      status: 'Paid',
      recurrenceId: null,
      sourceAccountId: PJ,
      destinationAccountId: PF,
      description: 'PIX SINTETICO',
    })
  })

  it('Só transferência e Aporte na PJ não criam lançamento: ficam fora do DRE', () => {
    const base = {
      amount: cents(1),
      date: isoDate('2026-09-05'),
      fromBankAccountId: PF,
      toBankAccountId: PJ,
      description: 'x',
    }
    expect(entryForTransferClassification('Transfer', base)).toBeNull()
    expect(entryForTransferClassification('CapitalContribution', base)).toBeNull()
  })

  it('uma opção que não vale para o sentido é recusada', () => {
    expect(() =>
      entryForTransferClassification(
        'ProLabore',
        {
          amount: cents(1),
          date: isoDate('2026-09-05'),
          fromBankAccountId: PF,
          toBankAccountId: PJ,
          description: 'x',
        },
        { from: 'PF', to: 'PJ' },
      ),
    ).toThrow('open_finance.transfer_classification_not_allowed')
  })
})

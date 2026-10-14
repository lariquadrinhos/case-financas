import { describe, expect, it } from 'vitest'

import {
  asId,
  cents,
  isoDate,
  type BankAccountId,
  type EntryId,
  type InvestmentId,
  type OccurrenceId,
  type RecurrenceId,
} from '@/domain/core'
import { cardImportStart, planImport, refusesManualPaid } from './rules'
import type {
  ImportedTransaction,
  ImportState,
  OpenFinanceAccount,
  OpenFinanceLink,
  OpenFinanceSnapshot,
  PlannedCandidate,
  ProviderAccountId,
  ProviderTransactionId,
} from './types'

/* Synthetic scenario (ADR-0009): one PF checking account that feeds the
   Consumo Livre, one PJ checking account, a card paid by the PF account and
   an investment. No value here belongs to anyone. */

const PF_ACCOUNT = asId<BankAccountId>('conta-pf')
const PJ_ACCOUNT = asId<BankAccountId>('conta-pj')
const INVESTMENT = asId<InvestmentId>('investimento-1')

const PF_CHECKING = 'prov-pf' as ProviderAccountId
const PJ_CHECKING = 'prov-pj' as ProviderAccountId
const CARD = 'prov-cartao' as ProviderAccountId
const BROKER = 'prov-corretora' as ProviderAccountId
const UNLINKED = 'prov-sem-vinculo' as ProviderAccountId

const LINKED_ON = isoDate('2026-09-01')

const LINKS: readonly OpenFinanceLink[] = [
  {
    providerAccountId: PF_CHECKING,
    target: { kind: 'BankAccount', bankAccountId: PF_ACCOUNT },
    linkedOn: LINKED_ON,
  },
  {
    providerAccountId: PJ_CHECKING,
    target: { kind: 'BankAccount', bankAccountId: PJ_ACCOUNT },
    linkedOn: LINKED_ON,
  },
  {
    providerAccountId: CARD,
    target: { kind: 'CreditCard', paidByBankAccountId: PF_ACCOUNT },
    linkedOn: LINKED_ON,
  },
  {
    providerAccountId: BROKER,
    target: { kind: 'Investment', investmentId: INVESTMENT },
    linkedOn: LINKED_ON,
  },
]

function state(overrides: Partial<ImportState> = {}): ImportState {
  return {
    links: LINKS,
    alreadyImported: new Set(),
    discretionarySourceAccountId: PF_ACCOUNT,
    bankAccountEntities: new Map([
      [PF_ACCOUNT, 'PF'],
      [PJ_ACCOUNT, 'PJ'],
    ]),
    planned: [],
    unpaidCardPurchases: [],
    ...overrides,
  }
}

let sequence = 0
function tx(
  accountId: ProviderAccountId,
  direction: 'In' | 'Out',
  amount: number,
  date: string,
  providerCategory: string | null = null,
  description = 'Transação sintética',
): ImportedTransaction {
  sequence += 1
  return {
    id: `tx-${sequence}` as ProviderTransactionId,
    accountId,
    date: isoDate(date),
    amount: cents(amount),
    direction,
    description,
    providerCategory,
  }
}

function snapshot(
  transactions: readonly ImportedTransaction[],
  accounts: readonly OpenFinanceAccount[] = [],
): OpenFinanceSnapshot {
  return { accounts, transactions }
}

function plannedEntry(
  bankAccountId: BankAccountId,
  direction: 'In' | 'Out',
  amount: number,
  date: string,
  id = 'previsto-1',
): PlannedCandidate {
  return {
    ref: { kind: 'Entry', entryId: asId<EntryId>(id) },
    bankAccountId,
    direction,
    amount: cents(amount),
    date: isoDate(date),
    counterpart: null,
  }
}

describe('planImport — idempotência e vínculo', () => {
  it('PRD §5 — importar a mesma transação duas vezes não gera segunda decisão (sem dupla contagem)', () => {
    const t = tx(PF_CHECKING, 'Out', 5000, '2026-09-10')
    const plan = planImport(snapshot([t]), state({ alreadyImported: new Set([t.id]) }))
    expect(plan.decisions).toEqual([])
  })

  it('ADR-0020 §3 — transação anterior à data do vínculo não é importada', () => {
    const t = tx(PF_CHECKING, 'Out', 5000, '2026-08-31')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([{ kind: 'Ignored', transaction: t, reason: 'BeforeLink' }])
  })

  it('ADR-0020 §3 — conta do provedor sem vínculo é ignorada', () => {
    const t = tx(UNLINKED, 'Out', 5000, '2026-09-10')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([{ kind: 'Ignored', transaction: t, reason: 'Unlinked' }])
  })
})

describe('planImport — conta corrente', () => {
  it('ADR-0020 §4 — saída da conta de origem do Consumo Livre vira gasto de Consumo Livre', () => {
    const t = tx(PF_CHECKING, 'Out', 4590, '2026-09-10', 'Groceries')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([{ kind: 'DiscretionaryExpense', transaction: t }])
  })

  it('ADR-0020 §4 — saída que casa com um Previsto paga o Previsto em vez de virar Consumo Livre', () => {
    const t = tx(PF_CHECKING, 'Out', 150000, '2026-09-12')
    const previsto = plannedEntry(PF_ACCOUNT, 'Out', 150000, '2026-09-10')
    const plan = planImport(snapshot([t]), state({ planned: [previsto] }))
    expect(plan.decisions).toEqual([{ kind: 'PayPlanned', transaction: t, ref: previsto.ref }])
  })

  it('PRD P49 — o casamento exige o mesmo valor e no máximo 5 dias de diferença', () => {
    const valorDiferente = tx(PF_CHECKING, 'Out', 150001, '2026-09-10')
    const longeDemais = tx(PF_CHECKING, 'Out', 150000, '2026-09-16')
    const previsto = plannedEntry(PF_ACCOUNT, 'Out', 150000, '2026-09-10')
    const plan = planImport(snapshot([valorDiferente, longeDemais]), state({ planned: [previsto] }))
    expect(plan.decisions.map((d) => d.kind)).toEqual([
      'DiscretionaryExpense',
      'DiscretionaryExpense',
    ])
  })

  it('PRD §5 — um Previsto é pago por uma transação só, mesmo com duas iguais', () => {
    const primeira = tx(PF_CHECKING, 'Out', 150000, '2026-09-10')
    const segunda = tx(PF_CHECKING, 'Out', 150000, '2026-09-11')
    const previsto = plannedEntry(PF_ACCOUNT, 'Out', 150000, '2026-09-10')
    const plan = planImport(snapshot([primeira, segunda]), state({ planned: [previsto] }))
    expect(plan.decisions.map((d) => d.kind)).toEqual(['PayPlanned', 'DiscretionaryExpense'])
  })

  it('ADR-0020 §4 — ocorrência aberta de recorrência também é paga pela transação', () => {
    const t = tx(PJ_CHECKING, 'Out', 45000, '2026-09-05')
    const ocorrencia: PlannedCandidate = {
      ref: {
        kind: 'Occurrence',
        occurrenceId: asId<OccurrenceId>('occ-1'),
        recurrenceId: asId<RecurrenceId>('rec-1'),
      },
      bankAccountId: PJ_ACCOUNT,
      direction: 'Out',
      amount: cents(45000),
      date: isoDate('2026-09-05'),
      counterpart: null,
    }
    const plan = planImport(snapshot([t]), state({ planned: [ocorrencia] }))
    expect(plan.decisions).toEqual([{ kind: 'PayPlanned', transaction: t, ref: ocorrencia.ref }])
  })

  it('PRD v7.46 — saída sem casamento fora do Consumo Livre vira despesa Paga em "A categorizar", com a entidade da conta', () => {
    const t = tx(PJ_CHECKING, 'Out', 9900, '2026-09-10', 'Groceries')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([
      {
        kind: 'Entry',
        transaction: t,
        entry: {
          kind: 'Expense',
          amount: cents(9900),
          date: isoDate('2026-09-10'),
          status: 'Paid',
          recurrenceId: null,
          entity: 'PJ',
          categoryId: 'a-categorizar',
          classification: 'Current',
          bankAccountId: PJ_ACCOUNT,
          description: 'Transação sintética',
        },
      },
    ])
  })

  it('PRD v7.46 — sem de-para: a categoria da Pluggy nunca decide a categoria; entrada e saída vão para "A categorizar"', () => {
    // Valores diferentes: iguais e na mesma data, o par seria uma Transferência.
    const salario = tx(PF_CHECKING, 'In', 10000, '2026-09-10', 'Salary')
    const mercado = tx(PJ_CHECKING, 'Out', 20000, '2026-09-10', 'Groceries')
    const plan = planImport(snapshot([salario, mercado]), state())
    const categorias = plan.decisions.map((d) => (d.kind === 'Entry' ? d.entry : null))
    expect(categorias.map((e) => (e && 'categoryId' in e ? e.categoryId : null))).toEqual([
      'a-categorizar-receita',
      'a-categorizar',
    ])
  })

  it('PRD P52 — estorno na conta corrente ainda não tem destino e é ignorado, não vira receita', () => {
    const t = tx(PF_CHECKING, 'In', 3000, '2026-09-10', null, 'ESTORNO COMPRA SINTETICA')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([{ kind: 'Ignored', transaction: t, reason: 'Refund' }])
  })
})

describe('planImport — entre contas próprias e intercompany', () => {
  it('ADR-0017 — PIX entre duas contas vinculadas vira Transferência, e não receita nem despesa', () => {
    const saida = tx(PJ_CHECKING, 'Out', 500000, '2026-09-05')
    const entrada = tx(PF_CHECKING, 'In', 500000, '2026-09-05')
    const plan = planImport(snapshot([saida, entrada]), state())
    expect(plan.decisions).toEqual([{ kind: 'Transfer', transaction: saida, counterpart: entrada }])
  })

  it('PRD §5 — eliminação intercompany: PIX PJ → PF sem Previsto nunca vira pró-labore sozinho', () => {
    const saida = tx(PJ_CHECKING, 'Out', 500000, '2026-09-05')
    const entrada = tx(PF_CHECKING, 'In', 500000, '2026-09-06')
    const plan = planImport(snapshot([saida, entrada]), state())
    expect(plan.decisions.some((d) => d.kind === 'Entry' || d.kind === 'PayPlanned')).toBe(false)
  })

  it('PRD §5 — pró-labore Previsto é pago pela entrada na PF, e a saída da PJ não vira despesa', () => {
    const saida = tx(PJ_CHECKING, 'Out', 500000, '2026-09-05')
    const entrada = tx(PF_CHECKING, 'In', 500000, '2026-09-05')
    const proLabore: PlannedCandidate = {
      ...plannedEntry(PF_ACCOUNT, 'In', 500000, '2026-09-05', 'pro-labore-1'),
      counterpart: { bankAccountId: PJ_ACCOUNT, direction: 'Out' },
    }
    const plan = planImport(snapshot([saida, entrada]), state({ planned: [proLabore] }))
    expect(plan.decisions).toEqual([
      { kind: 'Ignored', transaction: saida, reason: 'IntercompanyCounterpart' },
      { kind: 'PayPlanned', transaction: entrada, ref: proLabore.ref },
    ])
  })
})

describe('planImport — cartão de crédito', () => {
  it('PRD §5 e ADR-0021 — compra no cartão é despesa Prevista, marcada "Cartão de crédito", na conta que paga o cartão', () => {
    const compra = tx(CARD, 'Out', 12990, '2026-09-08', 'Groceries')
    const plan = planImport(snapshot([compra]), state())
    expect(plan.decisions).toEqual([
      {
        kind: 'CardPurchase',
        transaction: compra,
        entry: {
          kind: 'Expense',
          amount: cents(12990),
          date: isoDate('2026-09-08'),
          status: 'Planned',
          recurrenceId: null,
          entity: 'PF',
          categoryId: 'a-categorizar',
          classification: 'Current',
          bankAccountId: PF_ACCOUNT,
          description: 'Transação sintética',
          isCreditCard: true,
        },
      },
    ])
  })

  it('PRD §5 — pagamento da fatura nunca vira gasto de Consumo Livre (a compra contaria duas vezes)', () => {
    const pagamento = tx(PF_CHECKING, 'Out', 20000, '2026-09-20')
    const credito = tx(CARD, 'In', 20000, '2026-09-20')
    const plan = planImport(snapshot([pagamento, credito]), state())
    expect(plan.decisions.map((d) => d.kind)).toEqual(['CardBillPayment', 'Ignored'])
    expect(plan.decisions[1]).toEqual({
      kind: 'Ignored',
      transaction: credito,
      reason: 'CardBillCredit',
    })
  })

  it('PRD §5 — a fatura paga liquida as compras mais antigas até somar o valor pago', () => {
    const antiga = {
      entryId: asId<EntryId>('compra-antiga'),
      cardAccountId: CARD,
      date: isoDate('2026-09-02'),
      amount: cents(8000),
    }
    const media = {
      entryId: asId<EntryId>('compra-media'),
      cardAccountId: CARD,
      date: isoDate('2026-09-04'),
      amount: cents(12000),
    }
    const daProximaFatura = {
      entryId: asId<EntryId>('compra-proxima'),
      cardAccountId: CARD,
      date: isoDate('2026-09-18'),
      amount: cents(5000),
    }
    const pagamento = tx(PF_CHECKING, 'Out', 20000, '2026-09-20')
    const credito = tx(CARD, 'In', 20000, '2026-09-20')
    const plan = planImport(
      snapshot([pagamento, credito]),
      state({ unpaidCardPurchases: [daProximaFatura, media, antiga] }),
    )
    expect(plan.decisions[0]).toEqual({
      kind: 'CardBillPayment',
      transaction: pagamento,
      settles: [antiga.entryId, media.entryId],
      settlesInBatch: [],
    })
  })

  it('PRD §5 — a fatura liquida também as compras que chegaram no mesmo lote', () => {
    const compra = tx(CARD, 'Out', 20000, '2026-09-03', 'Groceries')
    const pagamento = tx(PF_CHECKING, 'Out', 20000, '2026-09-20')
    const credito = tx(CARD, 'In', 20000, '2026-09-20')
    const plan = planImport(snapshot([compra, pagamento, credito]), state())
    const fatura = plan.decisions.find((d) => d.kind === 'CardBillPayment')
    expect(fatura).toMatchObject({ settles: [], settlesInBatch: [compra.id] })
  })

  it('PRD P52 — crédito no cartão que não é pagamento de fatura (estorno) é ignorado', () => {
    const t = tx(CARD, 'In', 3000, '2026-09-10')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([{ kind: 'Ignored', transaction: t, reason: 'CardCredit' }])
  })
})

describe('planImport — saldos', () => {
  it('ADR-0020 §3 — conta e investimento vinculados recebem o saldo do banco; o cartão não mexe em saldo', () => {
    const accounts: OpenFinanceAccount[] = [
      {
        id: PF_CHECKING,
        kind: 'Checking',
        name: 'Conta',
        numberSuffix: '0001',
        institution: null,
        balance: cents(1000),
      },
      {
        id: CARD,
        kind: 'CreditCard',
        name: 'Cartão',
        numberSuffix: '0002',
        institution: null,
        balance: cents(500),
      },
      {
        id: BROKER,
        kind: 'Investment',
        name: 'CDB',
        numberSuffix: null,
        institution: null,
        balance: cents(90000),
      },
      {
        id: UNLINKED,
        kind: 'Checking',
        name: 'Outra',
        numberSuffix: null,
        institution: null,
        balance: cents(1),
      },
    ]
    const plan = planImport(snapshot([], accounts), state())
    expect(plan.balances).toEqual([
      { target: { kind: 'BankAccount', bankAccountId: PF_ACCOUNT }, balance: cents(1000) },
      { target: { kind: 'Investment', investmentId: INVESTMENT }, balance: cents(90000) },
    ])
  })

  it('ADR-0020 §4 — movimento dentro do investimento não vira lançamento: só o saldo é lido', () => {
    const t = tx(BROKER, 'In', 1234, '2026-09-10')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([
      { kind: 'Ignored', transaction: t, reason: 'InvestmentMovement' },
    ])
  })
})

describe('refusesManualPaid', () => {
  const base = {
    amount: cents(1000),
    status: 'Paid' as const,
    recurrenceId: null,
    entity: 'PF' as const,
    categoryId: asId<import('@/domain/core').CategoryId>('alimentacao'),
    classification: 'Current' as const,
  }

  it('ADR-0020 §3 — despesa Paga à mão numa conta vinculada é recusada a partir da data do vínculo', () => {
    const despesa = {
      ...base,
      kind: 'Expense' as const,
      date: isoDate('2026-09-10'),
      bankAccountId: PF_ACCOUNT,
    }
    expect(refusesManualPaid(despesa, LINKS)).toBe(true)
  })

  it('ADR-0020 §3 — antes da data do vínculo, ou como Previsto, continua permitido', () => {
    const antes = {
      ...base,
      kind: 'Expense' as const,
      date: isoDate('2026-08-31'),
      bankAccountId: PF_ACCOUNT,
    }
    const previsto = { ...antes, date: isoDate('2026-09-10'), status: 'Planned' as const }
    expect(refusesManualPaid(antes, LINKS)).toBe(false)
    expect(refusesManualPaid(previsto, LINKS)).toBe(false)
  })

  it('ADR-0020 §3 — o cartão vinculado não trava a conta que o paga para lançamento manual', () => {
    const soCartao = LINKS.filter((l) => l.target.kind === 'CreditCard')
    const despesa = {
      ...base,
      kind: 'Expense' as const,
      date: isoDate('2026-09-10'),
      bankAccountId: PF_ACCOUNT,
    }
    expect(refusesManualPaid(despesa, soCartao)).toBe(false)
  })

  it('PRD §5 — pró-labore Pago à mão continua permitido: a Transferência importada não criou lançamento', () => {
    const proLabore = {
      kind: 'ProLabore' as const,
      amount: cents(500000),
      date: isoDate('2026-09-05'),
      status: 'Paid' as const,
      recurrenceId: null,
      sourceAccountId: PJ_ACCOUNT,
      destinationAccountId: PF_ACCOUNT,
    }
    expect(refusesManualPaid(proLabore, LINKS)).toBe(false)
  })
})

describe('planImport — vários investimentos do banco num só', () => {
  it('ADR-0020 §3 — o Investimento recebe a SOMA dos saldos de todos os investimentos do banco vinculados a ele', () => {
    const CAIXINHA = 'prov-caixinha' as ProviderAccountId
    const links: OpenFinanceLink[] = [
      ...LINKS,
      {
        providerAccountId: CAIXINHA,
        target: { kind: 'Investment', investmentId: INVESTMENT },
        linkedOn: LINKED_ON,
      },
    ]
    const accounts: OpenFinanceAccount[] = [
      {
        id: BROKER,
        kind: 'Investment',
        name: 'CDB',
        numberSuffix: null,
        institution: null,
        balance: cents(90000),
      },
      {
        id: CAIXINHA,
        kind: 'Investment',
        name: 'Caixinha',
        numberSuffix: null,
        institution: null,
        balance: cents(10050),
      },
    ]
    const plan = planImport(snapshot([], accounts), state({ links }))
    expect(plan.balances).toEqual([
      { target: { kind: 'Investment', investmentId: INVESTMENT }, balance: cents(100050) },
    ])
  })
})

describe('planImport — várias contas do banco numa só Conta Bancária', () => {
  const PF_CHECKING_2 = 'prov-pf-2' as ProviderAccountId
  const links: OpenFinanceLink[] = [
    ...LINKS,
    {
      providerAccountId: PF_CHECKING_2,
      target: { kind: 'BankAccount', bankAccountId: PF_ACCOUNT },
      linkedOn: LINKED_ON,
    },
  ]

  it('ADR-0020 §3 — a Conta Bancária recebe a soma dos saldos das contas do banco vinculadas a ela', () => {
    const accounts: OpenFinanceAccount[] = [
      {
        id: PF_CHECKING,
        kind: 'Checking',
        name: 'A',
        numberSuffix: null,
        institution: null,
        balance: cents(1000),
      },
      {
        id: PF_CHECKING_2,
        kind: 'Checking',
        name: 'B',
        numberSuffix: null,
        institution: null,
        balance: cents(-300),
      },
    ]
    const plan = planImport(snapshot([], accounts), state({ links }))
    expect(plan.balances).toEqual([
      { target: { kind: 'BankAccount', bankAccountId: PF_ACCOUNT }, balance: cents(700) },
    ])
  })

  it('PRD §5 — dinheiro entre duas contas do banco da MESMA Conta Bancária é movimento interno: nem Consumo Livre, nem receita', () => {
    const saida = tx(PF_CHECKING, 'Out', 25000, '2026-09-10')
    const entrada = tx(PF_CHECKING_2, 'In', 25000, '2026-09-10')
    const plan = planImport(snapshot([saida, entrada]), state({ links }))
    expect(plan.decisions).toEqual([
      { kind: 'Ignored', transaction: saida, reason: 'InternalMovement' },
      { kind: 'Ignored', transaction: entrada, reason: 'InternalMovement' },
    ])
  })

  it('ADR-0020 §3 — a trava do Pago manual vale a partir do vínculo MAIS ANTIGO da conta', () => {
    const tardio: OpenFinanceLink[] = [
      { ...links[0]!, linkedOn: isoDate('2026-10-01') },
      ...links.slice(1),
    ]
    const despesa = {
      kind: 'Expense' as const,
      amount: cents(1000),
      date: isoDate('2026-09-15'),
      status: 'Paid' as const,
      recurrenceId: null,
      entity: 'PF' as const,
      categoryId: asId<import('@/domain/core').CategoryId>('alimentacao'),
      classification: 'Current' as const,
      bankAccountId: PF_ACCOUNT,
    }
    expect(refusesManualPaid(despesa, tardio)).toBe(true)
  })
})

describe('planImport — dinheiro próprio indo de um lugar seu para outro', () => {
  it('ADR-0017 — aplicação automática / investimento saindo da conta não é gasto de Consumo Livre', () => {
    const aplicacao = tx(PF_CHECKING, 'Out', 50000, '2026-09-10', 'Automatic investment')
    const aporte = tx(PF_CHECKING, 'Out', 30000, '2026-09-11', 'Investments')
    const plan = planImport(snapshot([aplicacao, aporte]), state())
    expect(plan.decisions.map((d) => (d.kind === 'Ignored' ? d.reason : d.kind))).toEqual([
      'OwnMoneyMovement',
      'OwnMoneyMovement',
    ])
  })

  it('ADR-0017 — resgate de investimento e transferência de mesma titularidade não viram receita', () => {
    const resgate = tx(PJ_CHECKING, 'In', 50000, '2026-09-10', 'Fixed income')
    const mesmaTitularidade = tx(PJ_CHECKING, 'In', 12000, '2026-09-12', 'Same person transfer')
    const plan = planImport(snapshot([resgate, mesmaTitularidade]), state())
    expect(
      plan.decisions.every((d) => d.kind === 'Ignored' && d.reason === 'OwnMoneyMovement'),
    ).toBe(true)
  })

  it('ADR-0017 — entre duas contas vinculadas continua sendo Transferência, mesmo com categoria de mesma titularidade', () => {
    const saida = tx(PJ_CHECKING, 'Out', 40000, '2026-09-05', 'Same person transfer')
    const entrada = tx(PF_CHECKING, 'In', 40000, '2026-09-05', 'Same person transfer')
    const plan = planImport(snapshot([saida, entrada]), state())
    expect(plan.decisions).toEqual([{ kind: 'Transfer', transaction: saida, counterpart: entrada }])
  })

  it('PRD §5 — pagamento de fatura sem par no cartão nunca vira gasto (a compra contaria duas vezes)', () => {
    const t = tx(PF_CHECKING, 'Out', 99999, '2026-09-20', 'Credit card payment')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([{ kind: 'Ignored', transaction: t, reason: 'CardBillCredit' }])
  })

  it('PRD P52 — entrada com categoria de gasto (mercado, posto) é estorno e não vira receita', () => {
    const t = tx(PF_CHECKING, 'In', 2500, '2026-09-10', 'Groceries')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions).toEqual([{ kind: 'Ignored', transaction: t, reason: 'Refund' }])
  })

  it('PIX para terceiros continua sendo gasto: é dinheiro que saiu de você', () => {
    const t = tx(PF_CHECKING, 'Out', 8000, '2026-09-10', 'Transfer - PIX')
    const plan = planImport(snapshot([t]), state())
    expect(plan.decisions.map((d) => d.kind)).toEqual(['DiscretionaryExpense'])
  })
})

describe('planImport — a compra pertence à fatura dela (billId)', () => {
  const FATURA_SET = { id: 'fatura-set', accountId: CARD, dueDate: isoDate('2026-09-10') }
  const FATURA_OUT = { id: 'fatura-out', accountId: CARD, dueDate: isoDate('2026-10-10') }

  function compra(id: string, date: string, billId: string | null, amount = 12990) {
    return {
      ...tx(CARD, 'Out', amount, date, 'Groceries'),
      id: id as ProviderTransactionId,
      billId,
    }
  }

  it('PRD §5 — regime de caixa: a compra fica Prevista no VENCIMENTO da fatura dela, não na data da compra', () => {
    const c = compra('c-out', '2026-09-03', 'fatura-out')
    const plan = planImport(
      { accounts: [], transactions: [c], bills: [FATURA_SET, FATURA_OUT] },
      state(),
    )
    const [d] = plan.decisions
    expect(d?.kind === 'CardPurchase' && [d.entry.status, d.entry.date]).toEqual([
      'Planned',
      '2026-10-10',
    ])
  })

  it('PRD §5 — medido em 2026-09-29: o pagamento de 11/09 quita a fatura de setembro e NÃO liquida compras da fatura de outubro', () => {
    const compraOutubro = compra('c-out', '2026-09-03', 'fatura-out', 20000)
    const pagamento = tx(PF_CHECKING, 'Out', 90000, '2026-09-11')
    const credito = tx(CARD, 'In', 90000, '2026-09-11')
    const plan = planImport(
      {
        accounts: [],
        transactions: [compraOutubro, pagamento, credito],
        bills: [FATURA_SET, FATURA_OUT],
      },
      state(),
    )
    expect(plan.decisions.find((d) => d.kind === 'CardBillPayment')).toMatchObject({
      settles: [],
      settlesInBatch: [],
    })
    expect(plan.decisions.find((d) => d.kind === 'CardPurchase')).toBeDefined()
  })

  it('PRD §5 — o pagamento da fatura de outubro liquida as compras dela, importadas antes', () => {
    const aberta = {
      entryId: asId<EntryId>('compra-out'),
      cardAccountId: CARD,
      date: isoDate('2026-10-10'),
      amount: cents(20000),
      billId: 'fatura-out',
    }
    const daSeguinte = { ...aberta, entryId: asId<EntryId>('compra-nov'), billId: 'fatura-nov' }
    const pagamento = tx(PF_CHECKING, 'Out', 20000, '2026-10-09')
    const credito = tx(CARD, 'In', 20000, '2026-10-09')
    const plan = planImport(
      { accounts: [], transactions: [pagamento, credito], bills: [FATURA_SET, FATURA_OUT] },
      state({ unpaidCardPurchases: [aberta, daSeguinte] }),
    )
    expect(plan.decisions[0]).toMatchObject({ kind: 'CardBillPayment', settles: ['compra-out'] })
  })
})

describe('Descrição (2026-09-29)', () => {
  it('o lançamento importado leva a descrição do banco', () => {
    const t = tx(PJ_CHECKING, 'Out', 9900, '2026-09-10', 'Groceries', 'PADARIA SINTETICA')
    const [d] = planImport(snapshot([t]), state()).decisions
    expect(d?.kind === 'Entry' && d.entry.description).toBe('PADARIA SINTETICA')
  })
})

describe('planImport — compra do cartão ainda PENDING (2026-10-01)', () => {
  // Medido em 2026-10-01: o banco segura toda compra da fatura aberta como
  // PENDING, sem billId, até a fatura fechar. A Pluggy diz que a passagem para
  // POSTED costuma manter o id, mas que uma mudança grande de data, valor ou
  // descrição apaga a transação e cria outra com id novo (docs.pluggy.ai,
  // "Transaction"); o providerId, a âncora sugerida, veio vazio nas 14
  // transações medidas.
  const FATURA_OUT = { id: 'fatura-out', accountId: CARD, dueDate: isoDate('2026-10-15') }
  const CARD_ACCOUNT: OpenFinanceAccount = {
    id: CARD,
    kind: 'CreditCard',
    name: 'Cartão Sintético',
    numberSuffix: null,
    institution: null,
    balance: cents(0),
  }

  function pendente(id: string, date: string, amount = 8000): ImportedTransaction {
    return {
      ...tx(CARD, 'Out', amount, date),
      id: id as ProviderTransactionId,
      billId: null,
      pending: true,
    }
  }
  function lancada(id: string, date: string, amount = 8000, billId = 'fatura-out') {
    return { ...pendente(id, date, amount), billId, pending: false }
  }
  function jaImportada(id: string, date: string, amount = 8000) {
    return {
      entryId: asId<EntryId>(`lanc-${id}`),
      transactionId: id as ProviderTransactionId,
      cardAccountId: CARD,
      date: isoDate(date),
      amount: cents(amount),
      billId: null,
      pending: true,
    }
  }

  it('PRD §5 — compra PENDING vira despesa Prevista em "A categorizar", para a pessoa classificar antes de a fatura fechar', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [pendente('p1', '2026-09-30')], bills: [] },
      state(),
    )
    const [d] = plan.decisions
    expect(d?.kind).toBe('CardPurchase')
    expect(
      d?.kind === 'CardPurchase' &&
        d.entry.kind === 'Expense' && [d.entry.status, d.entry.date, d.entry.categoryId],
    ).toEqual(['Planned', '2026-09-30', 'a-categorizar'])
  })

  it('PRD §5 — compra PENDING é da fatura ABERTA: nenhum pagamento a liquida', () => {
    const pagamento = tx(PF_CHECKING, 'Out', 8000, '2026-10-01')
    const credito = tx(CARD, 'In', 8000, '2026-10-01')
    const plan = planImport(
      {
        accounts: [CARD_ACCOUNT],
        transactions: [pendente('p1', '2026-09-30'), pagamento, credito],
        bills: [],
      },
      state({ unpaidCardPurchases: [jaImportada('p0', '2026-09-29')] }),
    )
    expect(plan.decisions.find((d) => d.kind === 'CardBillPayment')).toMatchObject({
      settles: [],
      settlesInBatch: [],
    })
  })

  it('PRD §5 — quando a fatura fecha (mesmo id, agora POSTED), o Previsto vai para o vencimento e guarda a fatura; a categoria é da pessoa e não muda', () => {
    const plan = planImport(
      {
        accounts: [CARD_ACCOUNT],
        transactions: [lancada('p1', '2026-09-30')],
        bills: [FATURA_OUT],
      },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-30')],
      }),
    )
    expect(plan.decisions).toEqual([])
    expect(plan.cardPurchaseChanges).toEqual([
      {
        kind: 'Updated',
        entryId: 'lanc-p1',
        previousTransactionId: 'p1',
        transaction: lancada('p1', '2026-09-30'),
        entryDate: '2026-10-15',
      },
    ])
  })

  it('PRD §5 — a compra que passou a POSTED no mesmo lote do pagamento da fatura dela é liquidada por ele', () => {
    const pagamento = tx(PF_CHECKING, 'Out', 8000, '2026-10-15')
    const credito = tx(CARD, 'In', 8000, '2026-10-15')
    const plan = planImport(
      {
        accounts: [CARD_ACCOUNT],
        transactions: [lancada('p1', '2026-09-30'), pagamento, credito],
        bills: [FATURA_OUT],
      },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-30')],
      }),
    )
    expect(plan.decisions.find((d) => d.kind === 'CardBillPayment')).toMatchObject({
      settles: ['lanc-p1'],
    })
  })

  it('compra que continua PENDING e igual não gera mudança nenhuma', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [pendente('p1', '2026-09-30')], bills: [] },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-30')],
      }),
    )
    expect(plan.decisions).toEqual([])
    expect(plan.cardPurchaseChanges).toEqual([])
  })

  it('compra PENDING que mudou de valor atualiza o Previsto (ex.: pré-autorização de hotel)', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [pendente('p1', '2026-09-30', 7500)], bills: [] },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-30')],
      }),
    )
    expect(plan.cardPurchaseChanges).toMatchObject([
      { kind: 'Updated', entryId: 'lanc-p1', entryDate: '2026-09-30' },
    ])
    expect(
      plan.cardPurchaseChanges[0]?.kind === 'Updated' &&
        plan.cardPurchaseChanges[0].transaction.amount,
    ).toBe(7500)
  })

  it('PRD §5 — a Pluggy recriou a compra com id novo: o Previsto (e a categoria da pessoa) passa para o id novo, sem segunda compra', () => {
    const recriada = lancada('p1-novo', '2026-09-30')
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [recriada], bills: [FATURA_OUT] },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-30')],
      }),
    )
    expect(plan.decisions).toEqual([])
    expect(plan.cardPurchaseChanges).toEqual([
      {
        kind: 'Updated',
        entryId: 'lanc-p1',
        previousTransactionId: 'p1',
        transaction: recriada,
        entryDate: '2026-10-15',
      },
    ])
  })

  it('compra PENDING que sumiu do banco sem substituta some do Bigorna (ex.: pré-autorização cancelada)', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [], bills: [] },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-30')],
      }),
    )
    expect(plan.cardPurchaseChanges).toEqual([
      { kind: 'Vanished', entryId: 'lanc-p1', transactionId: 'p1' },
    ])
  })

  it('compra PENDING com mais de 7 dias que some do banco NÃO é apagada: saiu da janela, não foi cancelada', () => {
    // docs.pluggy.ai, "Credit Card Installments": a fatura aberta chega pela
    // janela "last 7 days". Medido em 2026-10-01: conectado em 29/09, o banco
    // entregou só compras de 25/09 em diante. Fora da janela, a ausência não
    // diz que a compra foi cancelada — ela volta POSTED quando a fatura fecha.
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [], bills: [] },
      state({
        today: isoDate('2026-10-03'),
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-25')],
      }),
    )
    expect(plan.cardPurchaseChanges).toEqual([])
  })

  it('dentro da janela de 7 dias, a compra PENDING que some foi cancelada e sai', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [], bills: [] },
      state({
        today: isoDate('2026-10-01'),
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-25')],
      }),
    )
    expect(plan.cardPurchaseChanges).toMatchObject([{ kind: 'Vanished', transactionId: 'p1' }])
  })

  it('cartão que o banco não devolveu nesta leitura não tem compra apagada', () => {
    const plan = planImport(
      { accounts: [], transactions: [], bills: [] },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [jaImportada('p1', '2026-09-30')],
      }),
    )
    expect(plan.cardPurchaseChanges).toEqual([])
  })

  it('compra já POSTED (fatura fechada) que some do retrato não é apagada: só a PENDING ainda pode sumir', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [], bills: [] },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [{ ...jaImportada('p1', '2026-09-30'), pending: false }],
      }),
    )
    expect(plan.cardPurchaseChanges).toEqual([])
  })
})

describe('cardImportStart — o cartão importa a fatura aberta inteira (2026-10-01)', () => {
  // Medido em 2026-10-01: com o vínculo em 29/09, a fatura que fechou em 08/09
  // seguia aberta com 3 compras de 25 e 26/09 fora do Bigorna. O pagamento dela
  // liquidaria só parte das compras, e o DRE do mês do pagamento ficaria abaixo
  // do que saiu da conta.
  const fatura = (id: string, closingDate: string | undefined, dueDate: string) => ({
    id,
    accountId: CARD,
    dueDate: isoDate(dueDate),
    ...(closingDate === undefined ? {} : { closingDate: isoDate(closingDate) }),
  })

  it('PRD §5 — começa no dia do último fechamento até hoje, o "melhor dia de compra" (a compra desse dia já é da fatura aberta)', () => {
    expect(
      cardImportStart(
        [fatura('ago', '2026-08-08', '2026-08-15'), fatura('set', '2026-09-08', '2026-09-15')],
        isoDate('2026-10-01'),
      ),
    ).toBe('2026-09-08')
  })

  it('fechamento ainda no futuro não conta: vale o anterior', () => {
    expect(
      cardImportStart(
        [fatura('set', '2026-09-08', '2026-09-15'), fatura('out', '2026-10-08', '2026-10-15')],
        isoDate('2026-10-01'),
      ),
    ).toBe('2026-09-08')
  })

  it('sem fechamento informado, começa hoje (a regra do dia do vínculo)', () => {
    expect(cardImportStart([fatura('x', undefined, '2026-09-15')], isoDate('2026-10-01'))).toBe(
      '2026-10-01',
    )
    expect(cardImportStart([], isoDate('2026-10-01'))).toBe('2026-10-01')
  })
})

describe('planImport — a compra PENDING fica no vencimento da fatura aberta (2026-10-01)', () => {
  // O dono: "melhor data de compra é 8/10 e o vencimento é 15". A fatura aberta
  // ainda não existe no banco ("open bills are not returned until the bills are
  // closed", docs.pluggy.ai), mas as fechadas dizem o ciclo: fechou em 08/09 e
  // venceu em 15/09, então a aberta fecha em 08/10 e vence em 15/10.
  const SETEMBRO = {
    id: 'fatura-set',
    accountId: CARD,
    dueDate: isoDate('2026-09-15'),
    closingDate: isoDate('2026-09-08'),
  }
  const CARD_ACCOUNT: OpenFinanceAccount = {
    id: CARD,
    kind: 'CreditCard',
    name: 'Cartão Sintético',
    numberSuffix: null,
    institution: null,
    balance: cents(0),
  }
  const pendente = (id: string, date: string): ImportedTransaction => ({
    ...tx(CARD, 'Out', 8000, date),
    id: id as ProviderTransactionId,
    billId: null,
    pending: true,
  })
  const dataDe = (plan: ReturnType<typeof planImport>) =>
    plan.decisions.map((d) => (d.kind === 'CardPurchase' ? d.entry.date : null))

  it('PRD §5 — regime de caixa: compra de 25/09 na fatura aberta fica Prevista em 15/10, o vencimento dela', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [pendente('p1', '2026-09-25')], bills: [SETEMBRO] },
      state(),
    )
    expect(dataDe(plan)).toEqual(['2026-10-15'])
  })

  it('o dono: "melhor data de compra é 8" — a compra de 07/10 é da fatura de 15/10, a de 08/10 já é da de 15/11', () => {
    const plan = planImport(
      {
        accounts: [CARD_ACCOUNT],
        transactions: [pendente('p1', '2026-10-07'), pendente('p2', '2026-10-08')],
        bills: [SETEMBRO],
      },
      state(),
    )
    expect(dataDe(plan)).toEqual(['2026-10-15', '2026-11-15'])
  })

  it('sem fatura com fechamento informado, fica na data da compra', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [pendente('p1', '2026-09-25')], bills: [] },
      state(),
    )
    expect(dataDe(plan)).toEqual(['2026-09-25'])
  })

  it('a compra PENDING importada antes na data da compra é levada para o vencimento', () => {
    const plan = planImport(
      { accounts: [CARD_ACCOUNT], transactions: [pendente('p1', '2026-09-25')], bills: [SETEMBRO] },
      state({
        alreadyImported: new Set(['p1' as ProviderTransactionId]),
        unpaidCardPurchases: [
          {
            entryId: asId<EntryId>('lanc-p1'),
            transactionId: 'p1' as ProviderTransactionId,
            cardAccountId: CARD,
            date: isoDate('2026-09-25'),
            entryDate: isoDate('2026-09-25'),
            amount: cents(8000),
            billId: null,
            pending: true,
          },
        ],
      }),
    )
    expect(plan.cardPurchaseChanges).toMatchObject([
      { kind: 'Updated', entryId: 'lanc-p1', entryDate: '2026-10-15' },
    ])
  })
})

/**
 * The Pluggy payload → the domain snapshot.
 *
 * The payloads are SYNTHETIC, shaped after the examples of docs.pluggy.ai
 * ("Accounts", "Transactions", "Investments"). No response of a real account
 * enters this repository, not even "anonymised" (ADR-0020 §7).
 */

import { describe, expect, it } from 'vitest'

import {
  normalizeAccount,
  normalizeBill,
  normalizeInvestment,
  normalizeTransaction,
} from './normalize'

describe('normalizeAccount', () => {
  it('conta BANK vira Checking com saldo em centavos e só os últimos dígitos do número', () => {
    expect(
      normalizeAccount({
        id: 'acc-1',
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        number: '0001/12345-0',
        name: 'Conta Corrente',
        marketingName: 'Conta Sintética',
        balance: 1209.5,
        currencyCode: 'BRL',
        owner: 'Pessoa Sintética',
        taxNumber: '000.000.000-00',
      }),
    ).toEqual({
      id: 'acc-1',
      kind: 'Checking',
      name: 'Conta Sintética',
      numberSuffix: '3450',
      institution: null,
      balance: 120950,
    })
  })

  it('ADR-0020 §3 — nem titular nem CPF/CNPJ atravessam a porta (minimização)', () => {
    const account = normalizeAccount({
      id: 'acc-2',
      type: 'CREDIT',
      subtype: 'CREDIT_CARD',
      number: '1234',
      name: 'Cartão Sintético',
      balance: 142.41,
      currencyCode: 'BRL',
      owner: 'Pessoa Sintética',
      taxNumber: '***.***.123-22',
    })
    expect(account).toEqual({
      id: 'acc-2',
      kind: 'CreditCard',
      name: 'Cartão Sintético',
      numberSuffix: '1234',
      institution: null,
      balance: 14241,
    })
    expect(JSON.stringify(account)).not.toMatch(/Pessoa|123-22/)
  })
})

describe('normalizeTransaction', () => {
  const bank = { id: 'acc-1', kind: 'Checking' as const }
  const card = { id: 'acc-2', kind: 'CreditCard' as const }

  it('débito na conta corrente (valor negativo) vira saída com valor positivo', () => {
    expect(
      normalizeTransaction(
        {
          id: 'tx-1',
          description: 'MERCADO SINTETICO',
          amount: -45.9,
          date: '2026-09-10T00:00:00.000Z',
          category: 'Groceries',
          status: 'POSTED',
          type: 'DEBIT',
          currencyCode: 'BRL',
        },
        bank,
      ),
    ).toEqual({
      id: 'tx-1',
      accountId: 'acc-1',
      date: '2026-09-10',
      amount: 4590,
      direction: 'Out',
      description: 'MERCADO SINTETICO',
      providerCategory: 'Groceries',
      billId: null,
      pending: false,
    })
  })

  it('no cartão o sinal é o inverso: positivo é compra (saída), negativo é pagamento (entrada)', () => {
    const base = {
      description: 'x',
      date: '2026-09-10T00:00:00.000Z',
      status: 'POSTED',
      currencyCode: 'BRL',
    }
    const compra = normalizeTransaction({ ...base, id: 'c', amount: 159.2, type: 'CREDIT' }, card)
    const pagamento = normalizeTransaction({ ...base, id: 'p', amount: -150, type: 'DEBIT' }, card)
    expect([compra?.direction, compra?.amount]).toEqual(['Out', 15920])
    expect([pagamento?.direction, pagamento?.amount]).toEqual(['In', 15000])
  })

  it('transação PENDING da conta corrente fica de fora: ela ainda pode mudar de valor ou sumir', () => {
    expect(
      normalizeTransaction(
        {
          id: 'tx-p',
          description: 'x',
          amount: -1,
          date: '2026-09-10T00:00:00.000Z',
          status: 'PENDING',
          currencyCode: 'BRL',
        },
        bank,
      ),
    ).toBeNull()
  })

  it('PRD §5 — compra PENDING do cartão entra, marcada pendente: o banco só a dá como POSTED quando a fatura fecha', () => {
    // Medido em 2026-10-01: as compras do cartão feitas depois do fechamento
    // de 08/09 estavam todas PENDING e sem billId; as 7 POSTED eram as da
    // fatura já fechada. Descartar a PENDING deixava a compra fora do
    // Bigorna por até um mês.
    const t = normalizeTransaction(
      {
        id: 'tx-cp',
        description: 'LOJA SINTETICA',
        amount: 80,
        date: '2026-09-30T00:00:00.000Z',
        status: 'PENDING',
        currencyCode: 'BRL',
        creditCardMetadata: null,
      },
      card,
    )
    expect(t).toMatchObject({ id: 'tx-cp', direction: 'Out', amount: 8000, pending: true })
  })

  it('compra em moeda estrangeira usa o valor já convertido para a moeda da conta', () => {
    const t = normalizeTransaction(
      {
        id: 'tx-usd',
        description: 'x',
        amount: 10,
        amountInAccountCurrency: 55.3,
        date: '2026-09-10T00:00:00.000Z',
        status: 'POSTED',
        currencyCode: 'USD',
      },
      card,
    )
    expect(t?.amount).toBe(5530)
  })

  it('a data é o dia informado pelo banco, sem conversão de fuso (CLAUDE.md §6, "Datas")', () => {
    const t = normalizeTransaction(
      {
        id: 'tx-d',
        description: 'x',
        amount: -1,
        date: '2026-10-01T00:00:00.000Z',
        status: 'POSTED',
        currencyCode: 'BRL',
      },
      bank,
    )
    expect(t?.date).toBe('2026-10-01')
  })
})

describe('normalizeInvestment', () => {
  it('investimento vira conta Investment com o saldo informado', () => {
    expect(
      normalizeInvestment({ id: 'inv-1', name: 'CDB Sintético', balance: 1000.01, number: null }),
    ).toEqual({
      id: 'inv-1',
      kind: 'Investment',
      name: 'CDB Sintético',
      numberSuffix: null,
      institution: null,
      balance: 100001,
    })
  })
})

describe('normalizeBill', () => {
  it('lê o vencimento e o fechamento da fatura, sem fuso', () => {
    expect(
      normalizeBill(
        {
          id: 'fatura-1',
          dueDate: '2026-09-15T00:00:00.000Z',
          billClosingDate: '2026-09-08T00:00:00.000Z',
          totalAmount: 100,
        },
        'acc-2',
      ),
    ).toEqual({
      id: 'fatura-1',
      accountId: 'acc-2',
      dueDate: '2026-09-15',
      closingDate: '2026-09-08',
    })
  })
})

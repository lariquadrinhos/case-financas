/**
 * `POST /api/v1/transfers` — Transferência (ADR-0017 §2, hotspot H12).
 *
 * O que esta suíte protege é a invariante que o desenho anterior quebrava por
 * construção. `block-detail-modal.tsx` disparava um `PATCH` por lado do
 * movimento, e o próprio comentário admitia: "não é uma transação atômica de
 * backend, então se uma falhar as anteriores já aconteceram". Debitava a conta,
 * falhava ao creditar o investimento, e os R$ 5.000 deixavam de existir.
 *
 * O caso "recusada não move nada" é o teste dessa invariante que dá para
 * escrever sem derrubar o banco no meio: se a operação não vale, NENHUM dos
 * dois lados pode ter mudado. No desenho antigo esse mesmo cenário debitava a
 * origem antes de descobrir o problema.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, formatMoney } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'

function jsonRequest(body: unknown): Request {
  return new Request('https://x/api/v1/transfers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/v1/transfers', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function cenario() {
    const conta = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(800000),
    })
    const investimento = await handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'Investimento Sintético',
      entity: 'PF',
      accumulatedValue: cents(2200000),
    })
    return { conta, investimento }
  }

  const saldos = async (contaId: string, investimentoId: string) => ({
    conta: (await handle.repositories.bankAccountReader.findById(TEST_USER_ID, contaId as never))
      ?.balance,
    investimento: (
      await handle.repositories.investmentReader.findById(TEST_USER_ID, investimentoId as never)
    )?.accumulatedValue,
  })

  it('debita a origem e credita o destino na mesma requisição', async () => {
    const { conta, investimento } = await cenario()

    const response = await POST(
      jsonRequest({
        date: '2026-09-11',
        sources: [{ position: { kind: 'BankAccount', bankAccountId: conta.id }, amount: 500000 }],
        destination: { kind: 'Investment', investmentId: investimento.id },
        amount: 500000,
      }),
    )

    expect(response.status).toBe(200)
    expect(await saldos(conta.id, investimento.id)).toEqual({
      conta: cents(300000),
      investimento: cents(2700000),
    })
  })

  it('recusada, não move NENHUM dos dois lados', async () => {
    const { conta, investimento } = await cenario()

    const response = await POST(
      jsonRequest({
        date: '2026-09-11',
        // Mais do que a conta tem: 800.000 na conta contra 900.000 pedidos.
        sources: [{ position: { kind: 'BankAccount', bankAccountId: conta.id }, amount: 900000 }],
        destination: { kind: 'Investment', investmentId: investimento.id },
        amount: 900000,
      }),
    )

    expect(response.status).toBe(409)
    expect(await saldos(conta.id, investimento.id)).toEqual({
      conta: cents(800000),
      investimento: cents(2200000),
    })
  })

  it('recusa origem igual ao destino, sem tocar no saldo', async () => {
    const { conta, investimento } = await cenario()

    const response = await POST(
      jsonRequest({
        date: '2026-09-11',
        sources: [{ position: { kind: 'BankAccount', bankAccountId: conta.id }, amount: 100000 }],
        destination: { kind: 'BankAccount', bankAccountId: conta.id },
        amount: 100000,
      }),
    )

    expect(response.status).toBe(409)
    expect(await saldos(conta.id, investimento.id)).toEqual({
      conta: cents(800000),
      investimento: cents(2200000),
    })
  })

  it('soma o que sai de dois instrumentos de um bloco agregado', async () => {
    const { conta, investimento } = await cenario()
    const outraConta = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Segunda Conta Sintética',
      colour: 'itau',
      entity: 'PJ',
      balance: cents(400000),
    })

    const response = await POST(
      jsonRequest({
        date: '2026-09-11',
        sources: [
          { position: { kind: 'BankAccount', bankAccountId: conta.id }, amount: 500000 },
          { position: { kind: 'BankAccount', bankAccountId: outraConta.id }, amount: 300000 },
        ],
        destination: { kind: 'Investment', investmentId: investimento.id },
        amount: 800000,
      }),
    )

    expect(response.status).toBe(200)
    expect(await saldos(conta.id, investimento.id)).toEqual({
      conta: cents(300000),
      investimento: cents(3000000),
    })
  })
})

/**
 * ADR-0017 §3 — toda Transferência deixa rastro.
 *
 * Antes disto um redirecionamento não gravava Evento nenhum: a pessoa via os
 * dois saldos diferentes do que eram e não tinha como saber por quê, nem como
 * distinguir isso de uma correção de cadastro feita à mão.
 *
 * O Evento nasce dentro de `applyTransfer` (src/api/transfers.ts), e não na
 * rota, justamente para que as DUAS rotas que movem valor entre posições o
 * gravem sem precisar lembrar.
 */
describe('POST /api/v1/transfers — o Evento de rastreabilidade (ADR-0017 §3)', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('grava um Evento nomeando valor, origem e destino', async () => {
    const conta = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(800000),
    })
    const investimento = await handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'Investimento Sintético',
      entity: 'PF',
      accumulatedValue: cents(0),
    })

    await POST(
      new Request('https://x/api/v1/transfers', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-09-11',
          sources: [{ position: { kind: 'BankAccount', bankAccountId: conta.id }, amount: 500000 }],
          destination: { kind: 'Investment', investmentId: investimento.id },
          amount: 500000,
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    const eventos = await handle.repositories.traceEventReader.listRecent(TEST_USER_ID)
    expect(eventos).toHaveLength(1)
    expect(eventos[0]!.kind).toBe('Transfer')
    // `formatMoney` põe espaço NÃO-QUEBRÁVEL depois de "R$" (Intl pt-BR), então
    // a expectativa é montada com ele — um literal digitado à mão falha por um
    // caractere invisível.
    expect(eventos[0]!.description).toBe(
      `${formatMoney(cents(500000))} redirecionados de Conta Sintética para Investimento Sintético`,
    )
    // A origem gravada é o DESTINO — ver `TraceEventOrigin`.
    expect(eventos[0]!.origin).toEqual({ kind: 'Investment', investmentId: investimento.id })
  })
})

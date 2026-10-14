/**
 * `POST /api/v1/leftover-directions` — direcionar a sobra do Consumo Livre.
 *
 * ADR-0017 §4, com o refinamento medido em 2026-09-11: esta origem **não** é um
 * Direcionamento que só credita. A sobra do Consumo Livre é dinheiro que está
 * numa conta conhecida — `config.sourceAccountId`, que a própria configuração
 * do widget guarda —, então mandá-la para um investimento é uma TRANSFERÊNCIA:
 * sai de um lado e entra no outro.
 *
 * Creditar sem debitar aqui inflaria o Patrimônio Líquido (`netWorth =
 * totalAssets − totalLiabilities`, com `balance` e `accumulatedValue` somando
 * no Ativo) — a mesma classe de defeito que a Transferência acabou de fechar,
 * só na direção oposta: dinheiro aparecendo em vez de sumir.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'

function jsonRequest(body: unknown): Request {
  return new Request('https://x/api/v1/leftover-directions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/v1/leftover-directions — a sobra é uma Transferência (ADR-0017 §4)', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function cenario() {
    const origem = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta de Origem Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(1000000),
    })
    await handle.repositories.discretionarySpendingConfigWriter.save(TEST_USER_ID, {
      monthlyAmount: cents(200000),
      sourceAccountId: origem.id,
      entity: 'PF',
    })
    const investimento = await handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'Investimento Sintético',
      entity: 'PF',
      accumulatedValue: cents(500000),
    })
    return { origem, investimento }
  }

  it('debita a conta de origem da verba e credita o investimento', async () => {
    const { origem, investimento } = await cenario()

    const response = await POST(
      jsonRequest({
        month: '2026-09',
        amount: 50000,
        destination: { kind: 'Investment', investmentId: investimento.id },
      }),
    )

    expect(response.status).toBe(201)
    const conta = await handle.repositories.bankAccountReader.findById(TEST_USER_ID, origem.id)
    const inv = await handle.repositories.investmentReader.findById(TEST_USER_ID, investimento.id)
    expect(conta?.balance).toBe(cents(950000))
    expect(inv?.accumulatedValue).toBe(cents(550000))
  })

  it('não mexe em saldo nenhum quando a sobra volta para o Consumo Livre', async () => {
    const { origem } = await cenario()

    const response = await POST(
      jsonRequest({ month: '2026-09', amount: 50000, destination: { kind: 'Discretionary' } }),
    )

    expect(response.status).toBe(201)
    // O destino `Discretionary` sobe a verba do mês seguinte
    // (`leftoverBroughtForward`); o dinheiro continua na mesma conta.
    const conta = await handle.repositories.bankAccountReader.findById(TEST_USER_ID, origem.id)
    expect(conta?.balance).toBe(cents(1000000))
  })

  it('recusa destino Passivo em vez de registrar um no-op silencioso', async () => {
    await cenario()
    const passivo = await handle.repositories.liabilityWriter.create(TEST_USER_ID, {
      name: 'Dívida Sintética',
      creditor: 'Credor Sintético',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(1000000),
      installmentAmount: cents(100000),
      installmentCount: 10,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.01,
      startDate: isoDate('2026-01-10'),
    })

    const response = await POST(
      jsonRequest({
        month: '2026-09',
        amount: 50000,
        destination: { kind: 'Liability', liabilityId: passivo.id },
      }),
    )

    expect(response.status).toBe(422)
  })
})

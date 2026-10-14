/**
 * A data do vínculo é HOJE (decisão do dono, 2026-09-29: "ao invés de pegar
 * lançamentos passados, vamos começar a pegar somente de hoje em diante").
 * Relógio real de propósito: o outro arquivo de testes fixa o relógio no dia 1º
 * para exercitar o mês inteiro. No dia 1º os dois critérios coincidem e este
 * teste não distingue — o que é aceito.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import type { ProviderAccountId } from '@/domain/open-finance'
import { setOpenFinanceReader } from '@/data'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { todayIsoDate } from '@/lib/clock'
import { PUT as link } from './links/[providerAccountId]/route'
import { POST as createAndLink } from './links/[providerAccountId]/position/route'

const CONTA = 'prov-conta' as ProviderAccountId
const OUTRA = 'prov-outra' as ProviderAccountId

describe('data do vínculo', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
    setOpenFinanceReader({
      async listAccounts() {
        return [
          {
            id: CONTA,
            kind: 'Checking',
            name: 'A',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
          {
            id: OUTRA,
            kind: 'Checking',
            name: 'B',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
        ]
      },
      async listTransactions() {
        return []
      },
      async listBills() {
        return []
      },
    })
  })

  afterEach(() => {
    setOpenFinanceReader(null)
    handle.teardown()
  })

  it('vincular e "Criar conta nova" começam a importar de HOJE, não do dia 1º do mês', async () => {
    const conta = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
    const req = (url: string, method: string, body: unknown) =>
      new Request(`https://x${url}`, {
        method,
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      })

    await link(
      req(`/api/v1/open-finance/links/${CONTA}`, 'PUT', {
        target: { kind: 'BankAccount', bankAccountId: conta.id },
      }),
      { params: Promise.resolve({ providerAccountId: CONTA }) },
    )
    await createAndLink(
      req(`/api/v1/open-finance/links/${OUTRA}/position`, 'POST', { entity: 'PF' }),
      {
        params: Promise.resolve({ providerAccountId: OUTRA }),
      },
    )
    const datas = (await handle.repositories.openFinanceLinkReader.list(TEST_USER_ID)).map(
      (l) => l.linkedOn,
    )
    expect(datas).toEqual([todayIsoDate(), todayIsoDate()])
  })
})

describe('data do vínculo do cartão (2026-10-01)', () => {
  let handle: TestRepositories
  const CARTAO = 'prov-cartao' as ProviderAccountId

  afterEach(() => {
    setOpenFinanceReader(null)
    handle.teardown()
  })

  it('PRD §5 — o cartão começa no dia do último fechamento de fatura (o melhor dia de compra), para a fatura aberta entrar inteira', async () => {
    handle = useTestRepositories()
    // Datas relativas a hoje: o relógio é o real (ver o cabeçalho).
    const hoje = todayIsoDate()
    const dias = (n: number) =>
      new Date(Date.parse(`${hoje}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
    setOpenFinanceReader({
      async listAccounts() {
        return [
          {
            id: CARTAO,
            kind: 'CreditCard',
            name: 'Cartão',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
        ]
      },
      async listTransactions() {
        return []
      },
      async listBills(_userId, accountId) {
        return [
          {
            id: 'fechada',
            accountId,
            dueDate: isoDate(dias(-15)),
            closingDate: isoDate(dias(-22)),
          },
          { id: 'futura', accountId, dueDate: isoDate(dias(15)), closingDate: isoDate(dias(8)) },
        ]
      },
    })
    const conta = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
    const response = await link(
      new Request(`https://x/api/v1/open-finance/links/${CARTAO}`, {
        method: 'PUT',
        body: JSON.stringify({ target: { kind: 'CreditCard', paidByBankAccountId: conta.id } }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ providerAccountId: CARTAO }) },
    )
    expect(response.status).toBe(200)
    const [vinculo] = await handle.repositories.openFinanceLinkReader.list(TEST_USER_ID)
    expect(vinculo?.linkedOn).toBe(dias(-22))
  })
})

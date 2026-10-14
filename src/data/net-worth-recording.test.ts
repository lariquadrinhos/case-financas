/**
 * P21 — o retrato mensal do PL é gravado pelo DECORADOR, não pelas rotas.
 *
 * Este arquivo testa exatamente essa costura: uma mutação de patrimônio
 * qualquer, feita pela porta, tem que deixar o retrato dos três Balanços
 * gravado, sem que ninguém tenha chamado o gravador. É o que garante que uma
 * rota nova nasça coberta.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cents, isoDate, type IsoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'

describe('o retrato mensal do PL (P21)', () => {
  let handle: TestRepositories
  let today: IsoDate

  beforeEach(() => {
    today = isoDate('2026-07-20')
    handle = useTestRepositories(() => today)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('criar uma conta bancária grava o retrato das três visões, sem a rota pedir', async () => {
    const { bankAccountWriter, netWorthSnapshotReader } = handle.repositories
    await bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(179_600_00),
    })

    const consolidated = await netWorthSnapshotReader.listByView(TEST_USER_ID, 'Consolidated')
    const pf = await netWorthSnapshotReader.listByView(TEST_USER_ID, 'PF')
    const pj = await netWorthSnapshotReader.listByView(TEST_USER_ID, 'PJ')

    expect(consolidated).toEqual([
      {
        month: '2026-07',
        view: 'Consolidated',
        netWorth: 179_600_00,
        // P22: o mesmo retrato carrega o total investido. Zero aqui porque o
        // cenário só cria uma conta bancária.
        investmentsTotal: 0,
        recordedOn: '2026-07-20',
      },
    ])
    expect(pf[0]?.netWorth).toBe(179_600_00)
    // A mesma conta é PF: na visão PJ ela não existe, e o PL de lá é zero.
    expect(pj[0]?.netWorth).toBe(0)
  })

  it('a segunda mudança do MESMO mês sobrescreve: o retrato do mês é o fechamento dele', async () => {
    const { bankAccountWriter, netWorthSnapshotReader } = handle.repositories
    const account = await bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(100_000),
    })
    await bankAccountWriter.replace(TEST_USER_ID, { ...account, balance: cents(300_000) })

    const snapshots = await netWorthSnapshotReader.listByView(TEST_USER_ID, 'Consolidated')
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.netWorth).toBe(300_000)
  })

  it('mudança em mês novo cria linha nova, e a do mês anterior fica intacta', async () => {
    const { bankAccountWriter, netWorthSnapshotReader } = handle.repositories
    const account = await bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(100_000),
    })

    today = isoDate('2026-08-03')
    await bankAccountWriter.replace(TEST_USER_ID, { ...account, balance: cents(250_000) })

    const snapshots = await netWorthSnapshotReader.listByView(TEST_USER_ID, 'Consolidated')
    expect(snapshots.map((s) => [s.month, s.netWorth])).toEqual([
      ['2026-07', 100_000],
      ['2026-08', 250_000],
    ])
  })
})

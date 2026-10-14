/**
 * `POST /api/v1/tangible-assets/{id}/sale` — "Vender Bem Material"
 * (files_design/01 §11, UC12, UC37).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/tangible-assets/{id}/sale', () => {
  let handle: TestRepositories

  beforeEach(async () => {
    handle = useTestRepositories()
    // A rota agora cria o Lançamento do Ganho/Perda, que aponta para a
    // categoria "ganho-perda-venda-de-ativo" — sem o plano de contas semeado a
    // escrita bate na FK e a rota devolve 404 (P33).
    await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
    await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedAccount() {
    return handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
  }

  async function seedCar() {
    return handle.repositories.tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Carro',
      entity: 'PF',
      recordedValue: cents(8000000),
    })
  }

  it('UC12 — computes gain, removes the asset from Bens Materiais, no leftover means no Pendência', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()
    const response = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 9000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [{ kind: 'Revenue', amount: 9000000 }],
      }),
      context(car.id),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      asset: { id: string; soldOn: string }
      gainOrLoss: number
      pendingAmount: number
    }
    expect(body.gainOrLoss).toBe(1000000)
    expect(body.pendingAmount).toBe(0)
    expect(body.asset.soldOn).toBe('2026-03-15')

    // Sold assets leave the Bens Materiais list but stay findable by id.
    expect(await handle.repositories.tangibleAssetReader.listUnsold(TEST_USER_ID)).toEqual([])
    expect(
      (await handle.repositories.tangibleAssetReader.findById(TEST_USER_ID, car.id))?.soldOn,
    ).toBe('2026-03-15')
    expect(
      await handle.repositories.pendingAllocationReader.listByStatus(TEST_USER_ID, 'Pending'),
    ).toEqual([])
  })

  it('UC37 — leftover value becomes a Pendente de Direcionamento', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()
    const response = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 9000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [{ kind: 'Revenue', amount: 6000000 }],
      }),
      context(car.id),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ pendingAmount: 3000000 })

    const pending = await handle.repositories.pendingAllocationReader.listByStatus(
      TEST_USER_ID,
      'Pending',
    )
    expect(pending).toEqual([
      expect.objectContaining({
        amount: 3000000,
        originDate: '2026-03-15',
        origin: { kind: 'TangibleAssetSale', tangibleAssetId: car.id },
      }),
    ])
  })

  it('rejects a sale whose allocations exceed the sale amount (422)', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()
    const response = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 5000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [{ kind: 'Revenue', amount: 9000000 }],
      }),
      context(car.id),
    )
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      code: 'asset_sale.allocations_exceed_amount',
    })

    // Nothing was persisted — the asset is still unsold.
    expect(await handle.repositories.tangibleAssetReader.listUnsold(TEST_USER_ID)).toEqual([car])
  })

  it('refuses to sell the same asset twice (409)', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()
    await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 9000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [],
      }),
      context(car.id),
    )

    const secondSale = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 1000000,
        date: '2026-04-01',
        gainAccountId: accountId,
        allocations: [],
      }),
      context(car.id),
    )
    expect(secondSale.status).toBe(409)
    await expect(secondSale.json()).resolves.toMatchObject({ code: 'asset_sale.already_sold' })
  })

  /**
   * UC37: the Direcionamentos split the sale value and "o resto" becomes a
   * Pendente de Direcionamento. An Allocation SUBTRACTS from that remainder,
   * so a `target` naming nothing used to consume the whole sale and leave no
   * Pendência at all — 200 OK with the money gone from every table.
   */
  it('UC37 — refuses a Direcionamento whose target does not exist, and writes nothing', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()

    const response = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 9000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [{ kind: 'Investment', target: 'ghost-investment', amount: 9000000 }],
      }),
      context(car.id),
    )

    expect(response.status).toBe(404)
    // Nothing half-happened: the bem is still on the list and no Pendência was
    // invented for a sale that never completed.
    const asset = await handle.repositories.tangibleAssetReader.findById(TEST_USER_ID, car.id)
    expect(asset?.soldOn).toBeNull()
    await expect(
      handle.repositories.pendingAllocationReader.list(TEST_USER_ID),
    ).resolves.toHaveLength(0)
  })

  it('refuses a Direcionamento pointing at another Passivo that does not exist', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()
    const response = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 9000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [{ kind: 'Liability', target: 'ghost-liability', amount: 1000 }],
      }),
      context(car.id),
    )
    expect(response.status).toBe(404)
  })

  it('accepts a Direcionamento whose target really exists', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()
    const investment = await handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'CDB',
      entity: 'PF',
      accumulatedValue: cents(0),
    })

    const response = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 9000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [{ kind: 'Investment', target: investment.id, amount: 4000000 }],
      }),
      context(car.id),
    )

    expect(response.status).toBe(200)
    // "o resto" — only the undirected part becomes a Pendência (files_design/03).
    await expect(response.json()).resolves.toMatchObject({ pendingAmount: 5000000 })
  })

  it('answers 404 for an asset that does not exist', async () => {
    const accountId = (await seedAccount()).id
    const response = await POST(
      jsonRequest('https://x/api/v1/tangible-assets/ghost/sale', {
        amount: 100,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [],
      }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })

  /**
   * P33, resolvida em 2026-09-07. O modal sempre prometeu "Lançado
   * automaticamente em Resultado Não Operacional" (frame `99:56`,
   * files_design/01 §11) e o Lançamento NUNCA era criado — o ganho não
   * aparecia em DRE, Balanço, Evolução Mensal nem Indicadores, só no JSON da
   * própria resposta, que ninguém guarda. Este teste falha contra o código
   * antigo: `entryReader.listByMonth` voltava vazio.
   */
  it('P33 — cria o Lançamento do Ganho em Resultado Não Operacional, como o modal promete', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()

    await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 9000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [],
      }),
      context(car.id),
    )

    const entries = await handle.repositories.entryReader.listByMonth(
      TEST_USER_ID,
      '2026-03' as never,
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      kind: 'Revenue',
      // Ganho = 90.000 − 80.000. Magnitude; o sinal quem carrega é o `kind`.
      amount: 1000000,
      categoryId: 'ganho-perda-venda-de-ativo',
      status: 'Paid',
      entity: 'PF',
      bankAccountId: accountId,
    })
  })

  it('P33 — uma venda com PERDA vira Despesa, com o valor em magnitude', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()

    await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 5000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [],
      }),
      context(car.id),
    )

    const entries = await handle.repositories.entryReader.listByMonth(
      TEST_USER_ID,
      '2026-03' as never,
    )
    expect(entries[0]).toMatchObject({ kind: 'Expense', amount: 3000000 })
  })

  it('P33 — venda sem ganho nem perda não cria Lançamento nenhum', async () => {
    const accountId = (await seedAccount()).id
    const car = await seedCar()

    await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${car.id}/sale`, {
        amount: 8000000,
        date: '2026-03-15',
        gainAccountId: accountId,
        allocations: [],
      }),
      context(car.id),
    )

    const entries = await handle.repositories.entryReader.listByMonth(
      TEST_USER_ID,
      '2026-03' as never,
    )
    expect(entries).toHaveLength(0)
  })
})

/**
 * ADR-0017 §4 — um Direcionamento CREDITA o destino.
 *
 * O número errado que isto conserta é do Balanço, e é grande. Vender um bem de
 * R$ 300.000 por R$ 350.000 e direcionar tudo para um investimento tirava o bem
 * do Ativo (`soldOn`) e **não punha nada no lugar**: o Patrimônio Líquido caía
 * R$ 300.000 numa operação que deveria SUBIR R$ 50.000, o ganho.
 *
 * A venda é a única das três origens onde creditar sem debitar está certo, e é
 * por medição: a contrapartida existe e é explícita — o bem sai do Ativo no
 * mesmo instante. Na Destinação do Lucro não há conta de origem no agregado, e
 * creditar inflaria o Balanço; por isso ela continua só registrando.
 */
describe('POST /api/v1/tangible-assets/{id}/sale — o Direcionamento credita (ADR-0017 §4)', () => {
  let handle: TestRepositories

  beforeEach(async () => {
    handle = useTestRepositories()
    // Mesmo motivo do describe acima: o Lançamento do Ganho aponta para uma
    // categoria do plano padrão, e sem ela a escrita bate na FK.
    await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
    await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function contaEBem() {
    const conta = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
    const bem = await handle.repositories.tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Bem Sintético',
      entity: 'PF',
      recordedValue: cents(30000000),
    })
    return { conta, bem }
  }

  it('sobe o accumulatedValue do investimento de destino', async () => {
    const { conta, bem } = await contaEBem()
    const investimento = await handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'Investimento Sintético',
      entity: 'PF',
      accumulatedValue: cents(200000),
    })

    const response = await POST(
      jsonRequest(`https://x/api/v1/tangible-assets/${bem.id}/sale`, {
        amount: 35000000,
        date: '2026-09-11',
        gainAccountId: conta.id,
        allocations: [{ kind: 'Investment', target: investimento.id, amount: 35000000 }],
      }),
      context(bem.id),
    )

    expect(response.status).toBe(200)
    const depois = await handle.repositories.investmentReader.findById(
      TEST_USER_ID,
      investimento.id,
    )
    expect(depois?.accumulatedValue).toBe(cents(35200000))
  })

  it('recusa destino Passivo em vez de registrar um no-op silencioso', async () => {
    const { conta, bem } = await contaEBem()
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
      jsonRequest(`https://x/api/v1/tangible-assets/${bem.id}/sale`, {
        amount: 35000000,
        date: '2026-09-11',
        gainAccountId: conta.id,
        allocations: [{ kind: 'Liability', target: passivo.id, amount: 1000000 }],
      }),
      context(bem.id),
    )

    expect(response.status).toBe(422)
    // E a venda inteira não aconteceu: recusar depois de gravar metade seria o
    // defeito que a ADR-0017 fecha, de novo.
    const aindaLa = await handle.repositories.tangibleAssetReader.findById(TEST_USER_ID, bem.id)
    expect(aindaLa?.soldOn).toBeNull()
  })
})

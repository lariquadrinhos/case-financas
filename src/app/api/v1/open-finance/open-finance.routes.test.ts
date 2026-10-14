/**
 * `/api/v1/open-finance/**` — the whole chain against a SYNTHETIC bank
 * (ADR-0020 §7): link → sync → sync again → the guard on manual Pago.
 *
 * The bank is a fake `OpenFinanceReader` bound through `setOpenFinanceReader`,
 * the same seam production binds the Pluggy adapter through. No request
 * leaves the process.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O vínculo passa a valer de HOJE (link-date.test.ts cobre isso com o relógio
// real). Aqui o relógio fica no dia 1º do mês corrente para que os cenários
// exercitem o mês inteiro, com transações em vários dias.
vi.mock('@/lib/clock', () => {
  const now = new Date()
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  return { todayIsoDate: () => first }
})

import { cents, isoDate, type Cents } from '@/domain/core'
import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import type {
  CardBill,
  ImportedTransaction,
  OpenFinanceAccount,
  ProviderAccountId,
  ProviderTransactionId,
} from '@/domain/open-finance'
import { setOpenFinanceReader, type OpenFinanceReader } from '@/data'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET as listAccounts } from './accounts/route'
import { DELETE as unlink, PUT as link } from './links/[providerAccountId]/route'
import { GET as monthMovement } from './month-movement/route'
import { GET as syncStatus, POST as sync } from './sync/route'
import { PUT as setAutoSync } from './auto-sync/route'
import { POST as reimport } from './reimport/route'
import { GET as entryOrigins } from './entry-origins/route'
import { POST as classifyTransfer } from './transfers/[transactionId]/classification/route'
import { GET as pendingItems } from '../pending-items/route'
import { PATCH as patchEntry } from '../entries/[id]/route'
import { GET as accountTransactions } from './accounts/[providerAccountId]/transactions/route'
import { POST as createAndLink } from './links/[providerAccountId]/position/route'
import { POST as createEntry } from '../entries/route'
import { POST as confirmEntry } from '../entries/[id]/payment/route'
import { PATCH as patchBankAccount } from '../bank-accounts/[id]/route'
import { POST as createDiscretionaryExpense } from '../discretionary-spending/expenses/route'

const CHECKING = 'prov-conta' as ProviderAccountId
const CARD = 'prov-cartao' as ProviderAccountId

function fakeBank(
  accounts: OpenFinanceAccount[],
  transactions: ImportedTransaction[],
  bills: CardBill[] = [],
): OpenFinanceReader {
  return {
    async listBills(_userId, accountId) {
      return bills.filter((b) => b.accountId === accountId)
    },
    async listAccounts() {
      return accounts
    },
    async listTransactions(_userId, accountId, from) {
      return transactions.filter((t) => t.accountId === accountId && t.date >= from)
    },
  }
}

function tx(
  id: string,
  accountId: ProviderAccountId,
  direction: 'In' | 'Out',
  amount: number,
  date: string,
): ImportedTransaction {
  return {
    id: id as ProviderTransactionId,
    accountId,
    date: isoDate(date),
    amount: cents(amount),
    direction,
    description: `Transação sintética ${id}`,
    providerCategory: 'Groceries',
  }
}

function json(method: string, url: string, body?: unknown): Request {
  return new Request(`https://x${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const params = (providerAccountId: string) => ({ params: Promise.resolve({ providerAccountId }) })

function nextMonthDay(day: number): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, day)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The first day of the current month: the link date the PUT stamps. */
function thisMonth(day: number): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${String(day).padStart(2, '0')}`
}

describe('/api/v1/open-finance', () => {
  let handle: TestRepositories
  let contaId: string

  beforeEach(async () => {
    handle = useTestRepositories()
    const repos = handle.repositories
    await repos.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
    await repos.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
    const conta = await repos.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
    contaId = conta.id
    await repos.discretionarySpendingConfigWriter.save(TEST_USER_ID, {
      monthlyAmount: cents(100000),
      sourceAccountId: conta.id,
      entity: 'PF',
    })
  })

  afterEach(() => {
    setOpenFinanceReader(null)
    handle.teardown()
  })

  function bind(transactions: ImportedTransaction[], balance: Cents = cents(123456)) {
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CHECKING,
            kind: 'Checking',
            name: 'Conta',
            numberSuffix: '0001',
            institution: null,
            balance,
          },
          {
            id: CARD,
            kind: 'CreditCard',
            name: 'Cartão',
            numberSuffix: '0002',
            institution: null,
            balance: cents(0),
          },
        ],
        transactions,
      ),
    )
  }

  async function linkAll() {
    const conta = await link(
      json('PUT', `/api/v1/open-finance/links/${CHECKING}`, {
        target: { kind: 'BankAccount', bankAccountId: contaId },
      }),
      params(CHECKING),
    )
    expect(conta.status).toBe(200)
    const cartao = await link(
      json('PUT', `/api/v1/open-finance/links/${CARD}`, {
        target: { kind: 'CreditCard', paidByBankAccountId: contaId },
      }),
      params(CARD),
    )
    expect(cartao.status).toBe(200)
  }

  const forceSync = () => sync(json('POST', '/api/v1/open-finance/sync', { force: true }))

  it('dono 2026-10-09 — soma o extrato do mês por Conta Bancária vinculada (entradas − saídas)', async () => {
    bind([])
    await linkAll()
    bind([
      tx('m1', CHECKING, 'Out', 4590, thisMonth(2)),
      tx('m2', CHECKING, 'In', 10000, thisMonth(3)),
      // A compra no cartão não move a conta corrente.
      tx('m3', CARD, 'Out', 777, thisMonth(3)),
    ])
    const month = thisMonth(1).slice(0, 7)
    const response = await monthMovement(
      new Request(`https://x/api/v1/open-finance/month-movement?month=${month}`),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: { bankAccountId: string; movement: number }[] }
    expect(body.data).toEqual([{ bankAccountId: contaId, movement: 5410 }])
  })

  it('lista as contas do banco com o vínculo de cada uma', async () => {
    bind([])
    await linkAll()
    const response = await listAccounts(json('GET', '/api/v1/open-finance/accounts'))
    const body = (await response.json()) as { data: { id: string; link: unknown }[] }
    expect(body.data.map((a) => [a.id, a.link !== null])).toEqual([
      [CHECKING, true],
      [CARD, true],
    ])
  })

  it('ADR-0020 §4 — sincronizar grava o saldo do banco e o gasto de Consumo Livre, com a descrição como Rótulo', async () => {
    bind([tx('t1', CHECKING, 'Out', 4590, thisMonth(2))])
    await linkAll()

    const response = await forceSync()
    expect(response.status).toBe(200)

    const conta = await handle.repositories.bankAccountReader.findById(
      TEST_USER_ID,
      contaId as never,
    )
    expect(conta?.balance).toBe(123456)
    const [gasto] = await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)
    expect([gasto?.amount, gasto?.label]).toEqual([4590, 'Transação sintética t1'])
  })

  it('2026-09-29 — o texto do banco é a Descrição do lançamento, também no gasto de Consumo Livre', async () => {
    bind([tx('t1', CHECKING, 'Out', 4590, thisMonth(2))])
    await linkAll()
    await forceSync()

    const [gasto] = await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)
    const lancamento = await handle.repositories.entryReader.findById(TEST_USER_ID, gasto!.id)
    expect(lancamento?.description).toBe('Transação sintética t1')
  })

  it('PRD §5 — sincronizar duas vezes não duplica nada (idempotência)', async () => {
    bind([tx('t1', CHECKING, 'Out', 4590, thisMonth(2))])
    await linkAll()
    await forceSync()
    await forceSync()
    expect(await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)).toHaveLength(
      1,
    )
  })

  it('PRD §5 — compra no cartão fica Prevista e vira Paga quando a fatura é paga, sem virar Consumo Livre', async () => {
    bind([tx('compra', CARD, 'Out', 20000, thisMonth(3))])
    await linkAll()
    await forceSync()
    const [prevista] = (
      await handle.repositories.entryReader.search(TEST_USER_ID, {
        status: null,
        view: null,
        month: null,
        categoryId: null,
        classification: null,
        bankAccountId: null,
        recurring: null,
      })
    ).items
    expect([prevista?.status, prevista?.kind === 'Expense' && prevista.categoryId]).toEqual([
      'Planned',
      'a-categorizar',
    ])

    bind([
      tx('compra', CARD, 'Out', 20000, thisMonth(3)),
      tx('pagamento', CHECKING, 'Out', 20000, thisMonth(10)),
      tx('credito-fatura', CARD, 'In', 20000, thisMonth(10)),
    ])
    await forceSync()

    const paga = await handle.repositories.entryReader.findById(TEST_USER_ID, prevista!.id)
    expect([paga?.status, paga?.date]).toEqual(['Paid', thisMonth(10)])
    expect(await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)).toEqual([])
  })

  it('2026-10-01 — com a sincronização automática desligada, abrir o app não lê o banco; "Sincronizar agora" lê', async () => {
    bind([tx('t1', CHECKING, 'Out', 4590, thisMonth(2))])
    await linkAll()
    const desligar = await setAutoSync(
      json('PUT', '/api/v1/open-finance/auto-sync', { enabled: false }),
    )
    expect(desligar.status).toBe(200)
    const status = (await (await syncStatus(json('GET', '/api/v1/open-finance/sync'))).json()) as {
      autoSync: boolean
    }
    expect(status.autoSync).toBe(false)

    const automatica = await sync(json('POST', '/api/v1/open-finance/sync', {}))
    expect(((await automatica.json()) as { status: string }).status).toBe('Paused')
    expect(await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)).toEqual([])

    const manual = await forceSync()
    expect(((await manual.json()) as { status: string }).status).toBe('Synced')
    expect(await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)).toHaveLength(
      1,
    )

    await setAutoSync(json('PUT', '/api/v1/open-finance/auto-sync', { enabled: true }))
    const status2 = (await (await syncStatus(json('GET', '/api/v1/open-finance/sync'))).json()) as {
      autoSync: boolean
    }
    expect(status2.autoSync).toBe(true)
  })

  it('PRD P53 — sem force, uma segunda sincronização dentro do intervalo é pulada', async () => {
    bind([])
    await linkAll()
    await forceSync()
    const response = await sync(json('POST', '/api/v1/open-finance/sync', {}))
    expect(((await response.json()) as { status: string }).status).toBe('Skipped')
  })

  it('dono 2026-10-09 — despesa Paga à mão na conta vinculada é aceita, e o banco não a duplica ao chegar', async () => {
    // Era recusada (ADR-0020 §3 na redação original). O dono: "deixa eu marcar
    // como pago". A transação do banco casa com o Pago manual pela mesma regra
    // do Previsto (P49: mesma conta, mesmo valor, até 5 dias).
    bind([])
    await linkAll()
    const despesa = {
      kind: 'Expense',
      amount: 1000,
      date: thisMonth(5),
      entity: 'PF',
      categoryId: 'alimentacao',
      classification: 'Current',
      bankAccountId: contaId,
      recurrence: null,
      status: 'Paid',
    }
    const paga = await createEntry(json('POST', '/api/v1/entries', despesa))
    expect(paga.status).toBe(201)
    const { id } = (await paga.json()) as { id: string }

    bind([tx('t-manual', CHECKING, 'Out', 1000, thisMonth(7))])
    await forceSync()

    const doMes = await handle.repositories.entryReader.search(TEST_USER_ID, {
      status: null,
      view: null,
      month: null,
      categoryId: null,
      classification: null,
      bankAccountId: null,
      recurring: null,
    })
    expect(doMes.items.filter((e) => e.amount === 1000).map((e) => e.id)).toEqual([id])
    const registros = await handle.repositories.importedTransactionReader.listRecords(TEST_USER_ID)
    expect(registros.find((r) => r.transactionId === 't-manual')?.entryId).toBe(id)
  })

  it('dono 2026-10-09 — "Confirmar" um Previsto da conta vinculada é aceito', async () => {
    bind([])
    await linkAll()
    const prevista = await createEntry(
      json('POST', '/api/v1/entries', {
        kind: 'Expense',
        amount: 2500,
        date: thisMonth(5),
        entity: 'PF',
        categoryId: 'alimentacao',
        classification: 'Current',
        bankAccountId: contaId,
        recurrence: null,
        status: 'Planned',
      }),
    )
    const { id } = (await prevista.json()) as { id: string }
    const response = await confirmEntry(
      json('POST', `/api/v1/entries/${id}/payment`, {
        paidAmount: 2500,
        paymentDate: thisMonth(6),
      }),
      { params: Promise.resolve({ id }) },
    )
    expect(response.status).toBe(200)
  })

  it('ADR-0020 §3 — o saldo da conta vinculada não é mais editado à mão', async () => {
    bind([])
    await linkAll()
    const response = await patchBankAccount(
      json('PATCH', `/api/v1/bank-accounts/${contaId}`, { balance: 1 }),
      { params: Promise.resolve({ id: contaId }) },
    )
    expect(response.status).toBe(409)
    const renomear = await patchBankAccount(
      json('PATCH', `/api/v1/bank-accounts/${contaId}`, { label: 'Outro nome' }),
      { params: Promise.resolve({ id: contaId }) },
    )
    expect(renomear.status).toBe(200)
  })

  it('PRD P48 — com a conta de origem vinculada, o gasto de Consumo Livre à mão é recusado', async () => {
    bind([])
    await linkAll()
    const response = await createDiscretionaryExpense(
      json('POST', '/api/v1/discretionary-spending/expenses', {
        date: thisMonth(5),
        amount: 1000,
      }),
    )
    expect(response.status).toBe(409)
  })

  it('ADR-0020 §3 — vincular cartão como Conta Bancária é recusado; desvincular libera o Pago manual', async () => {
    bind([])
    const errado = await link(
      json('PUT', `/api/v1/open-finance/links/${CARD}`, {
        target: { kind: 'BankAccount', bankAccountId: contaId },
      }),
      params(CARD),
    )
    expect(errado.status).toBe(422)

    await linkAll()
    expect(
      (await unlink(json('DELETE', `/api/v1/open-finance/links/${CHECKING}`), params(CHECKING)))
        .status,
    ).toBe(204)
    const paga = await createEntry(
      json('POST', '/api/v1/entries', {
        kind: 'Expense',
        amount: 1000,
        date: thisMonth(5),
        status: 'Paid',
        entity: 'PF',
        categoryId: 'alimentacao',
        classification: 'Current',
        bankAccountId: contaId,
        recurrence: null,
      }),
    )
    expect(paga.status).toBe(201)
  })

  it('"Criar e vincular" — cria a Conta Bancária com o nome e o saldo do banco, na entidade escolhida, e vincula', async () => {
    bind([], cents(98765))
    const response = await createAndLink(
      json('POST', `/api/v1/open-finance/links/${CHECKING}/position`, { entity: 'PJ' }),
      params(CHECKING),
    )
    expect(response.status).toBe(201)
    const contas = await handle.repositories.bankAccountReader.list(TEST_USER_ID)
    const nova = contas.find((c) => c.id !== contaId)
    expect([nova?.label, nova?.entity, nova?.balance]).toEqual(['Conta', 'PJ', 98765])
    const [vinculo] = await handle.repositories.openFinanceLinkReader.list(TEST_USER_ID)
    expect(vinculo?.target).toEqual({ kind: 'BankAccount', bankAccountId: nova?.id })
  })

  it('"Criar e vincular" — cartão não é posição: é recusado (ele aponta para quem paga)', async () => {
    bind([])
    const response = await createAndLink(
      json('POST', `/api/v1/open-finance/links/${CARD}/position`, { entity: 'PF' }),
      params(CARD),
    )
    expect(response.status).toBe(422)
  })

  it('ADR-0020 §3 — vários investimentos do banco somam num Investimento, e várias contas correntes numa Conta Bancária', async () => {
    const investimento = await handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'Reserva Sintética',
      entity: 'PF',
      accumulatedValue: cents(0),
    })
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CHECKING,
            kind: 'Checking',
            name: 'Conta',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
          {
            id: 'prov-conta-2' as ProviderAccountId,
            kind: 'Checking',
            name: 'Conta 2',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
          {
            id: 'prov-inv-1' as ProviderAccountId,
            kind: 'Investment',
            name: 'CDB',
            numberSuffix: null,
            institution: null,
            balance: cents(100),
          },
          {
            id: 'prov-inv-2' as ProviderAccountId,
            kind: 'Investment',
            name: 'Caixinha',
            numberSuffix: null,
            institution: null,
            balance: cents(50),
          },
        ],
        [],
      ),
    )
    for (const id of ['prov-inv-1', 'prov-inv-2']) {
      const r = await link(
        json('PUT', `/api/v1/open-finance/links/${id}`, {
          target: { kind: 'Investment', investmentId: investimento.id },
        }),
        params(id),
      )
      expect(r.status).toBe(200)
    }
    await link(
      json('PUT', `/api/v1/open-finance/links/${CHECKING}`, {
        target: { kind: 'BankAccount', bankAccountId: contaId },
      }),
      params(CHECKING),
    )
    const segunda = await link(
      json('PUT', '/api/v1/open-finance/links/prov-conta-2', {
        target: { kind: 'BankAccount', bankAccountId: contaId },
      }),
      params('prov-conta-2'),
    )
    expect(segunda.status).toBe(200)

    await forceSync()
    const somado = await handle.repositories.investmentReader.findById(
      TEST_USER_ID,
      investimento.id,
    )
    expect(somado?.accumulatedValue).toBe(150)
    const conta = await handle.repositories.bankAccountReader.findById(
      TEST_USER_ID,
      contaId as never,
    )
    expect(conta?.balance).toBe(0)
  })

  it('vincular recalcula na hora o saldo do cadastro, sem esperar a sincronização', async () => {
    bind([], cents(123456))
    await link(
      json('PUT', `/api/v1/open-finance/links/${CHECKING}`, {
        target: { kind: 'BankAccount', bankAccountId: contaId },
      }),
      params(CHECKING),
    )
    const conta = await handle.repositories.bankAccountReader.findById(
      TEST_USER_ID,
      contaId as never,
    )
    expect(conta?.balance).toBe(123456)
  })

  it('desvincular tira do saldo a parte da conta que saiu; a última a sair deixa o último saldo, que volta a ser manual', async () => {
    const SEGUNDA = 'prov-conta-2' as ProviderAccountId
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CHECKING,
            kind: 'Checking',
            name: 'A',
            numberSuffix: null,
            institution: null,
            balance: cents(1000),
          },
          {
            id: SEGUNDA,
            kind: 'Checking',
            name: 'B',
            numberSuffix: null,
            institution: null,
            balance: cents(250),
          },
        ],
        [],
      ),
    )
    for (const id of [CHECKING, SEGUNDA]) {
      await link(
        json('PUT', `/api/v1/open-finance/links/${id}`, {
          target: { kind: 'BankAccount', bankAccountId: contaId },
        }),
        params(id),
      )
    }
    const saldo = async () =>
      (await handle.repositories.bankAccountReader.findById(TEST_USER_ID, contaId as never))
        ?.balance
    expect(await saldo()).toBe(1250)

    await unlink(json('DELETE', `/api/v1/open-finance/links/${SEGUNDA}`), params(SEGUNDA))
    expect(await saldo()).toBe(1000)

    await unlink(json('DELETE', `/api/v1/open-finance/links/${CHECKING}`), params(CHECKING))
    expect(await saldo()).toBe(1000)
    const manual = await patchBankAccount(
      json('PATCH', `/api/v1/bank-accounts/${contaId}`, { balance: 1 }),
      { params: Promise.resolve({ id: contaId }) },
    )
    expect(manual.status).toBe(200)
  })

  it('PRD §5 — medido em 2026-09-29: o pagamento da fatura anterior não liquida as compras da fatura seguinte', async () => {
    const compra = {
      ...tx('compra-outubro', CARD, 'Out', 20000, thisMonth(3)),
      billId: 'fatura-seguinte',
    }
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CHECKING,
            kind: 'Checking',
            name: 'Conta',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
          {
            id: CARD,
            kind: 'CreditCard',
            name: 'Cartão',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
        ],
        [
          compra,
          tx('pagamento', CHECKING, 'Out', 90000, thisMonth(11)),
          tx('credito-fatura', CARD, 'In', 90000, thisMonth(11)),
        ],
        [
          { id: 'fatura-atual', accountId: CARD, dueDate: isoDate(thisMonth(10)) },
          { id: 'fatura-seguinte', accountId: CARD, dueDate: isoDate(nextMonthDay(10)) },
        ],
      ),
    )
    await linkAll()
    await forceSync()
    const [prevista] = (
      await handle.repositories.entryReader.search(TEST_USER_ID, {
        status: null,
        view: null,
        month: null,
        categoryId: null,
        classification: null,
        bankAccountId: null,
        recurring: null,
      })
    ).items
    expect([prevista?.status, prevista?.date]).toEqual(['Planned', nextMonthDay(10)])
  })

  describe('compra do cartão ainda PENDING (2026-10-01)', () => {
    const contaECartao: OpenFinanceAccount[] = [
      {
        id: CHECKING,
        kind: 'Checking',
        name: 'Conta',
        numberSuffix: null,
        institution: null,
        balance: cents(0),
      },
      {
        id: CARD,
        kind: 'CreditCard',
        name: 'Cartão',
        numberSuffix: null,
        institution: null,
        balance: cents(0),
      },
    ]
    const pendente = (id: string) => ({
      ...tx(id, CARD, 'Out', 8000, thisMonth(3)),
      billId: null,
      pending: true,
    })
    const todos = async () =>
      (
        await handle.repositories.entryReader.search(TEST_USER_ID, {
          status: null,
          view: null,
          month: null,
          categoryId: null,
          classification: null,
          bankAccountId: null,
          recurring: null,
        })
      ).items

    it('PRD §5 — a compra PENDING aparece para categorizar; quando a fatura fecha (com id novo) e é paga, ela entra no DRE com a categoria escolhida', async () => {
      setOpenFinanceReader(fakeBank(contaECartao, [pendente('p1')]))
      await linkAll()
      await forceSync()

      const [prevista] = await todos()
      expect([
        prevista?.status,
        prevista?.date,
        'categoryId' in prevista! && prevista.categoryId,
      ]).toEqual(['Planned', thisMonth(3), 'a-categorizar'])
      const pendencias = (await (
        await pendingItems(json('GET', '/api/v1/pending-items'))
      ).json()) as { data: { kind: string }[] }
      expect(pendencias.data.some((p) => p.kind === 'Uncategorized')).toBe(true)

      const patched = await patchEntry(
        json('PATCH', `/api/v1/entries/${prevista!.id}`, {
          kind: 'Expense',
          categoryId: 'aluguel-moradia',
        }),
        { params: Promise.resolve({ id: prevista!.id }) },
      )
      expect(patched.status).toBe(200)

      // A fatura fecha: a Pluggy recriou a compra com id novo, agora POSTED.
      const fatura = { id: 'fatura-x', accountId: CARD, dueDate: isoDate(nextMonthDay(10)) }
      const lancada = { ...pendente('p1-novo'), billId: 'fatura-x', pending: false }
      setOpenFinanceReader(fakeBank(contaECartao, [lancada], [fatura]))
      await forceSync()

      const depoisDoFechamento = await todos()
      expect(depoisDoFechamento).toHaveLength(1)
      expect(
        depoisDoFechamento.map((e) => [e.id, e.status, e.date, 'categoryId' in e && e.categoryId]),
      ).toEqual([[prevista!.id, 'Planned', nextMonthDay(10), 'aluguel-moradia']])

      setOpenFinanceReader(
        fakeBank(
          contaECartao,
          [
            lancada,
            tx('pagamento', CHECKING, 'Out', 8000, nextMonthDay(10)),
            tx('credito-fatura', CARD, 'In', 8000, nextMonthDay(10)),
          ],
          [fatura],
        ),
      )
      await forceSync()
      const paga = await handle.repositories.entryReader.findById(TEST_USER_ID, prevista!.id)
      expect([paga?.status, paga?.date]).toEqual(['Paid', nextMonthDay(10)])
    })

    it('a compra PENDING que some do banco (pré-autorização cancelada) some do Bigorna', async () => {
      setOpenFinanceReader(fakeBank(contaECartao, [pendente('p1')]))
      await linkAll()
      await forceSync()
      expect(await todos()).toHaveLength(1)

      setOpenFinanceReader(fakeBank(contaECartao, []))
      await forceSync()
      expect(await todos()).toEqual([])
      expect(await handle.repositories.importedTransactionReader.listIds(TEST_USER_ID)).toEqual(
        new Set(),
      )
    })
  })

  it('"Reimportar" refaz a importação com a configuração atual, sem duplicar: o Consumo Livre configurado depois passa a valer', async () => {
    await handle.connection.exec('delete from discretionary_spending_config')
    bind([
      tx('t1', CHECKING, 'Out', 4590, thisMonth(2)),
      tx('t2', CHECKING, 'Out', 1000, thisMonth(3)),
    ])
    await linkAll()
    await forceSync()
    const avulsas = async () =>
      (
        await handle.repositories.entryReader.search(TEST_USER_ID, {
          status: null,
          view: null,
          month: null,
          categoryId: null,
          classification: null,
          bankAccountId: null,
          recurring: null,
        })
      ).total
    expect(await avulsas()).toBe(2)
    expect(await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)).toHaveLength(
      0,
    )

    await handle.repositories.discretionarySpendingConfigWriter.save(TEST_USER_ID, {
      monthlyAmount: cents(100000),
      sourceAccountId: contaId as never,
      entity: 'PF',
    })
    const response = await reimport(json('POST', '/api/v1/open-finance/reimport', {}))
    expect(response.status).toBe(200)

    expect(await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)).toHaveLength(
      2,
    )
    expect(await avulsas()).toBe(2)
  })

  it('expandir uma conta mostra os movimentos do mês e o que cada um virou no Bigorna', async () => {
    bind([
      tx('t1', CHECKING, 'Out', 4590, thisMonth(2)),
      // Entrada sem categoria: com "Groceries" (o padrão de `tx`) seria estorno, ignorada.
      { ...tx('t2', CHECKING, 'In', 777, thisMonth(3)), providerCategory: null },
    ])
    await linkAll()
    await forceSync()
    const response = await accountTransactions(
      json('GET', `/api/v1/open-finance/accounts/${CHECKING}/transactions`),
      params(CHECKING),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { id: string; date: string; outcome: string | null; description: string }[]
    }
    expect(body.data.map((t) => [t.id, t.outcome])).toEqual([
      ['t2', 'Entry'],
      ['t1', 'DiscretionaryExpense'],
    ])
    expect(body.data[0]?.description).toBe('Transação sintética t2')
  })

  it('PRD v7.46 — sem de-para: o que vem do banco entra em "A categorizar", e o Reimportar preserva a categoria que a pessoa escolheu', async () => {
    const pj = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta PJ Sintética',
      colour: 'nubank',
      entity: 'PJ',
      balance: cents(0),
    })
    const CONTA_PJ = 'prov-pj' as ProviderAccountId
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CONTA_PJ,
            kind: 'Checking',
            name: 'PJ',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
        ],
        [
          {
            ...tx('pix', CONTA_PJ, 'Out', 30000, thisMonth(4)),
            providerCategory: 'Transfer - PIX',
          },
          { ...tx('mercado', CONTA_PJ, 'Out', 5000, thisMonth(5)), providerCategory: 'Groceries' },
        ],
      ),
    )
    await link(
      json('PUT', `/api/v1/open-finance/links/${CONTA_PJ}`, {
        target: { kind: 'BankAccount', bankAccountId: pj.id },
      }),
      params(CONTA_PJ),
    )
    await forceSync()
    const todos = async () =>
      (
        await handle.repositories.entryReader.search(TEST_USER_ID, {
          status: null,
          view: null,
          month: null,
          categoryId: null,
          classification: null,
          bankAccountId: null,
          recurring: null,
        })
      ).items
    expect((await todos()).map((e) => ('categoryId' in e ? e.categoryId : null))).toEqual([
      'a-categorizar',
      'a-categorizar',
    ])

    const origem = await entryOrigins(
      json('GET', `/api/v1/open-finance/entry-origins?month=${thisMonth(1).slice(0, 7)}`),
    )
    const origens = (await origem.json()) as {
      data: { entryId: string; description: string; providerCategory: string | null }[]
    }
    expect(origens.data.map((o) => [o.description, o.providerCategory]).sort()).toEqual([
      ['Transação sintética mercado', 'Groceries'],
      ['Transação sintética pix', 'Transfer - PIX'],
    ])

    const pix = (await todos()).find((e) => e.amount === 30000)!
    const patched = await patchEntry(
      json('PATCH', `/api/v1/entries/${pix.id}`, {
        kind: 'Expense',
        categoryId: 'aluguel-moradia',
      }),
      { params: Promise.resolve({ id: pix.id }) },
    )
    expect(patched.status).toBe(200)

    await reimport(json('POST', '/api/v1/open-finance/reimport', {}))
    const depois = (await todos()).map((e) => [e.amount, 'categoryId' in e ? e.categoryId : null])
    expect(depois.sort()).toEqual([
      [30000, 'aluguel-moradia'],
      [5000, 'a-categorizar'],
    ])
  })

  it('"Criar conta nova" usa o nome do BANCO, não o nome do produto, e o final quando o banco tem mais de uma conta', async () => {
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CHECKING,
            kind: 'Checking',
            name: 'Instituição Sintética S.A. - Conta de Pagamento (Pré-paga)',
            numberSuffix: '0036',
            institution: 'Banco Sintético',
            balance: cents(0),
          },
          {
            id: 'prov-outra' as ProviderAccountId,
            kind: 'Checking',
            name: 'Outra',
            numberSuffix: '0099',
            institution: 'Banco Sintético',
            balance: cents(0),
          },
          {
            id: 'prov-unica' as ProviderAccountId,
            kind: 'Checking',
            name: 'Produto Longo Qualquer',
            numberSuffix: '0001',
            institution: 'Banco Único',
            balance: cents(0),
          },
        ],
        [],
      ),
    )
    for (const id of [CHECKING, 'prov-unica']) {
      await createAndLink(
        json('POST', `/api/v1/open-finance/links/${id}/position`, { entity: 'PF' }),
        params(id),
      )
    }
    const nomes = (await handle.repositories.bankAccountReader.list(TEST_USER_ID))
      .map((c) => c.label)
      .filter((l) => l !== 'Conta Sintética')
      .sort()
    expect(nomes).toEqual(['Banco Sintético · final 0036', 'Banco Único'])
  })

  it('2026-09-29 — PJ→PF vira Pendência; classificar como Pró-labore cria o lançamento, e o Reimportar preserva a escolha', async () => {
    const pj = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'PJ Sintética',
      colour: 'itau',
      entity: 'PJ',
      balance: cents(0),
    })
    const CONTA_PJ = 'prov-pj' as ProviderAccountId
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CHECKING,
            kind: 'Checking',
            name: 'PF',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
          {
            id: CONTA_PJ,
            kind: 'Checking',
            name: 'PJ',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
        ],
        [
          {
            ...tx('saida-pj', CONTA_PJ, 'Out', 500000, thisMonth(5)),
            providerCategory: 'Transfer - PIX',
          },
          {
            ...tx('entrada-pf', CHECKING, 'In', 500000, thisMonth(5)),
            providerCategory: 'Transfer - PIX',
          },
        ],
      ),
    )
    for (const [id, bankAccountId] of [
      [CHECKING, contaId],
      [CONTA_PJ, pj.id],
    ] as const) {
      await link(
        json('PUT', `/api/v1/open-finance/links/${id}`, {
          target: { kind: 'BankAccount', bankAccountId },
        }),
        params(id),
      )
    }
    await forceSync()

    const pendencias = async () =>
      (
        (await (await pendingItems(json('GET', '/api/v1/pending-items'))).json()) as {
          data: { kind: string; item: { transactionId: string; from: string; to: string } }[]
        }
      ).data.filter((p) => p.kind === 'UnclassifiedTransfer')
    const [pendencia] = await pendencias()
    expect([pendencia?.item.from, pendencia?.item.to]).toEqual(['PJ', 'PF'])

    const response = await classifyTransfer(
      json(
        'POST',
        `/api/v1/open-finance/transfers/${pendencia!.item.transactionId}/classification`,
        {
          classification: 'ProLabore',
        },
      ),
      { params: Promise.resolve({ transactionId: pendencia!.item.transactionId }) },
    )
    expect(response.status).toBe(200)
    const proLabores = async () =>
      (
        await handle.repositories.entryReader.search(TEST_USER_ID, {
          status: null,
          view: null,
          month: null,
          categoryId: null,
          classification: null,
          bankAccountId: null,
          recurring: null,
        })
      ).items.filter((e) => e.kind === 'ProLabore')
    const [criado] = await proLabores()
    expect(criado).toMatchObject({
      kind: 'ProLabore',
      amount: 500000,
      sourceAccountId: pj.id,
      destinationAccountId: contaId,
    })
    expect(await pendencias()).toEqual([])

    await reimport(json('POST', '/api/v1/open-finance/reimport', {}))
    expect(await proLabores()).toHaveLength(1)
    expect(await pendencias()).toEqual([])
  })

  it('2026-09-29 — PF→PJ não aceita Pró-labore: só Aporte na PJ ou Só transferência', async () => {
    const pj = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'PJ Sintética',
      colour: 'itau',
      entity: 'PJ',
      balance: cents(0),
    })
    const CONTA_PJ = 'prov-pj' as ProviderAccountId
    setOpenFinanceReader(
      fakeBank(
        [
          {
            id: CHECKING,
            kind: 'Checking',
            name: 'PF',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
          {
            id: CONTA_PJ,
            kind: 'Checking',
            name: 'PJ',
            numberSuffix: null,
            institution: null,
            balance: cents(0),
          },
        ],
        [
          tx('saida-pf', CHECKING, 'Out', 70000, thisMonth(6)),
          tx('entrada-pj', CONTA_PJ, 'In', 70000, thisMonth(6)),
        ],
      ),
    )
    for (const [id, bankAccountId] of [
      [CHECKING, contaId],
      [CONTA_PJ, pj.id],
    ] as const) {
      await link(
        json('PUT', `/api/v1/open-finance/links/${id}`, {
          target: { kind: 'BankAccount', bankAccountId },
        }),
        params(id),
      )
    }
    await forceSync()
    const recusa = await classifyTransfer(
      json('POST', '/api/v1/open-finance/transfers/saida-pf/classification', {
        classification: 'ProLabore',
      }),
      { params: Promise.resolve({ transactionId: 'saida-pf' }) },
    )
    expect(recusa.status).toBe(422)
    const aporte = await classifyTransfer(
      json('POST', '/api/v1/open-finance/transfers/saida-pf/classification', {
        classification: 'CapitalContribution',
      }),
      { params: Promise.resolve({ transactionId: 'saida-pf' }) },
    )
    expect(aporte.status).toBe(200)
  })

  it('ADR-0020 §2 — sem credenciais, as rotas respondem 409 open_finance.not_configured', async () => {
    setOpenFinanceReader({
      async listAccounts() {
        throw new Error('open_finance.not_configured')
      },
      async listTransactions() {
        throw new Error('open_finance.not_configured')
      },
      async listBills() {
        throw new Error('open_finance.not_configured')
      },
    })
    const response = await listAccounts(json('GET', '/api/v1/open-finance/accounts'))
    expect(response.status).toBe(409)
    expect(((await response.json()) as { code: string }).code).toBe('open_finance.not_configured')
  })
})

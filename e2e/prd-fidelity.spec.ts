/**
 * PRD v7 fidelity e2e — against the REAL production server and the SEEDED
 * database (`src/data/fixtures/seed.ts`, run via `npm run db:seed` before this
 * suite). Every test below checks a VALUE or a BEHAVIOUR the PRD/files_design
 * specify, not merely that an endpoint answers 200 — a 200 with the wrong
 * number is a passing test that hides a broken product (CLAUDE.md §7.1).
 *
 * Each `test.describe` names the case(s) of use it proves, so removing or
 * weakening the underlying rule shows up here by name (CLAUDE.md §3).
 */

import { expect, test, type APIRequestContext } from '@playwright/test'

interface StatementLine {
  readonly kind: 'block' | 'subtotal'
  readonly key: string
  readonly amount: number
}
interface IncomeStatementBody {
  readonly netProfit: number
  readonly lines: readonly StatementLine[]
  /** A lista "Lançamentos deste mês"; desde a P6 ela também traz parcela de Passivo. */
  readonly rows: readonly { readonly source: { readonly kind: string } }[]
}

function blockAmount(body: IncomeStatementBody, key: string): number {
  const line = body.lines.find((l) => l.kind === 'block' && l.key === key)
  if (line === undefined) throw new Error(`block ${key} missing from the response`)
  return line.amount
}

async function incomeStatement(
  api: APIRequestContext,
  view: 'Consolidated' | 'PF' | 'PJ',
  statusFilter: 'Paid' | 'Planned',
  month = '2026-07',
): Promise<IncomeStatementBody> {
  const response = await api.get(
    `/api/v1/reports/income-statement?month=${month}&view=${view}&statusFilter=${statusFilter}`,
  )
  expect(response.status(), `${view}/${statusFilter} income statement`).toBe(200)
  return (await response.json()) as IncomeStatementBody
}

/* -------------------------------------------------------------------------
 * UC7 / UC34 — 3 visões x 2 filtros sobre o MESMO mês
 * ---------------------------------------------------------------------- */

test.describe('UC7/UC34 — o mesmo mês do DRE devolve cascatas diferentes por visão e por filtro', () => {
  test('PJ carrega o pró-labore como despesa; Consolidado o elimina inteiramente (PRD §1, §5)', async ({
    request,
  }) => {
    const pj = await incomeStatement(request, 'PJ', 'Paid')
    const consolidated = await incomeStatement(request, 'Consolidated', 'Paid')

    // Seed de julho: R$ 4.000,00 de pró-labore, único lançamento de Despesas
    // Administrativas que a visão PJ enxerga (seed.ts não cria outra despesa
    // PJ). A visão Consolidado não vê nada disso — só sobra o que a PF gastou
    // em Despesas Administrativas.
    const pjAdmin = blockAmount(pj, 'despesas-administrativas')
    const consolidatedAdmin = blockAmount(consolidated, 'despesas-administrativas')

    expect(pjAdmin).toBe(400_000) // R$ 4.000,00 de pró-labore
    expect(consolidatedAdmin).not.toBe(pjAdmin)
    expect(consolidatedAdmin).toBeGreaterThan(0) // as despesas administrativas da PF continuam lá
  })

  test('PF enxerga o pró-labore como receita; a Receita Bruta consolidada NÃO o soma de novo', async ({
    request,
  }) => {
    const pf = await incomeStatement(request, 'PF', 'Paid')
    const consolidated = await incomeStatement(request, 'Consolidated', 'Paid')

    const pfRevenue = blockAmount(pf, 'receita-bruta')
    const consolidatedRevenue = blockAmount(consolidated, 'receita-bruta')

    // A PF vê salário + outras receitas + pró-labore recebido.
    expect(pfRevenue).toBe(2_440_000) // R$ 24.400,00 — Figma 5:2
    // O Consolidado vê a mesma receita MENOS o pró-labore (é dinheiro interno).
    expect(consolidatedRevenue).toBe(pfRevenue - 400_000)
  })

  test('a mesma estrutura de 13 linhas se repete nas 3 visões (PRD §1 — cascata idêntica)', async ({
    request,
  }) => {
    const [consolidated, pf, pj] = await Promise.all([
      incomeStatement(request, 'Consolidated', 'Paid'),
      incomeStatement(request, 'PF', 'Paid'),
      incomeStatement(request, 'PJ', 'Paid'),
    ])
    for (const statement of [consolidated, pf, pj]) {
      expect(statement.lines).toHaveLength(13)
    }
  })

  test('alternar Pago/Previsto muda o resultado do MESMO mês — os dois filtros leem universos disjuntos', async ({
    request,
  }) => {
    const paid = await incomeStatement(request, 'Consolidated', 'Paid')
    const planned = await incomeStatement(request, 'Consolidated', 'Planned')

    expect(paid.netProfit).not.toBe(0)
    expect(planned.netProfit).not.toBe(paid.netProfit)

    // Este teste afirmava `planned.netProfit === 0`, com o comentário "o seed
    // não cria nenhum Lançamento Previsto". Continuava verdade sobre
    // LANÇAMENTOS e deixou de ser verdade sobre o DRE: desde a P6 (produto,
    // 2026-09-08) a parcela de Passivo conta na cascata, e a parcela de julho é
    // Prevista. O Previsto de julho não é mais vazio, e o zero era propriedade
    // da fixture, não da regra.
    //
    // O que o teste existe para provar continua igual e fica mais forte medido
    // assim: os dois filtros leem universos DISJUNTOS, nunca somados (PRD §1).
    // No Previsto de julho não há receita nenhuma, e a única despesa é a
    // parcela — todo o resto da cascata é zero.
    const parcelas = planned.rows.filter((row) => row.source.kind === 'Installment')
    expect(parcelas.length).toBeGreaterThan(0)

    expect(blockAmount(planned, 'receita-bruta')).toBe(0)
    expect(blockAmount(planned, 'despesas-pessoais')).toBe(0)
    expect(blockAmount(planned, 'custo-dos-servicos')).toBe(0)
    // O lucro Previsto é exatamente o negativo da despesa administrativa, que é
    // só a parcela: nada mais entrou.
    expect(planned.netProfit).toBe(-blockAmount(planned, 'despesas-administrativas'))
  })

  test('UC34 — um mês futuro mostra a projeção Previsto de um lançamento recém-criado, nunca no Pago', async ({
    request,
  }) => {
    // Um lançamento novo, Previsto, num mês que o seed nunca tocou.
    const accounts = (await (await request.get('/api/v1/bank-accounts')).json()) as {
      data: readonly { id: string; entity: string }[]
    }
    const pfAccount = accounts.data.find((a) => a.entity === 'PF')
    expect(pfAccount).toBeDefined()
    const categories = (await (await request.get('/api/v1/categories')).json()) as {
      data: readonly { id: string }[]
    }
    const anyCategory = categories.data[0]
    expect(anyCategory).toBeDefined()

    // A month no other test in this suite touches, and a value chosen so the
    // assertion below is a DELTA (before/after), not a hard-coded total for
    // the month — re-running this test against the same persisted database
    // must not depend on the month being pristine.
    const targetMonth = '2031-03'
    const before = await incomeStatement(request, 'Consolidated', 'Planned', targetMonth)

    const created = await request.post('/api/v1/entries', {
      data: {
        kind: 'Expense',
        amount: 77_000,
        date: `${targetMonth}-10`,
        status: 'Planned',
        entity: 'PF',
        categoryId: anyCategory!.id,
        classification: 'Current',
        bankAccountId: pfAccount!.id,
        recurrence: null,
      },
    })
    expect(created.status()).toBe(201)
    const createdEntry = (await created.json()) as { id: string }

    try {
      const afterPlanned = await incomeStatement(request, 'Consolidated', 'Planned', targetMonth)
      const afterPaid = await incomeStatement(request, 'Consolidated', 'Paid', targetMonth)

      expect(afterPlanned.netProfit).toBe(before.netProfit - 77_000)
      // "Previsto não entra no DRE": a mesma despesa não aparece na base Pago.
      expect(afterPaid.netProfit).toBe(0)
    } finally {
      // Leaves the shared database exactly as this test found it, so a second
      // run of the suite exercises the SAME scenario instead of accumulating
      // one more Previsto lançamento in `targetMonth` every time it runs.
      await request.delete(`/api/v1/entries/${createdEntry.id}`)
    }
  })
})

/* -------------------------------------------------------------------------
 * PRD §5 / ADR-0003 — a eliminação intercompany fecha a conta na SOMA
 * ---------------------------------------------------------------------- */

test.describe('PRD §5/ADR-0003 — a soma dos lucros líquidos isolados fecha com o consolidado', () => {
  test('quando o único lançamento intercompany do mês é pró-labore, PF + PJ = Consolidado', async ({
    request,
  }) => {
    // A conta fecha porque o pró-labore é SIMÉTRICO: some do lado da PJ (despesa
    // operacional) exatamente o que aparece do lado da PF (receita) — o mesmo
    // valor, então a soma das duas visões isoladas já cancela sozinha o que o
    // Consolidado cancela por eliminação. Isto vale para julho/2026 do seed
    // porque o único lançamento intercompany do mês é pró-labore — o PRD §5
    // registra que essa reconciliação NÃO é garantida em geral (distribuição de
    // lucro é apropriação abaixo da linha só do lado da PJ, então soma e
    // consolidado divergem quando ela existe: ver
    // src/domain/reports/income-statement.test.ts "distribuição de lucro sits
    // below the line" — a mesma suposição não vale lá).
    const [pf, pj, consolidated] = await Promise.all([
      incomeStatement(request, 'PF', 'Paid'),
      incomeStatement(request, 'PJ', 'Paid'),
      incomeStatement(request, 'Consolidated', 'Paid'),
    ])

    expect(pf.netProfit + pj.netProfit).toBe(consolidated.netProfit)
  })
})

/* -------------------------------------------------------------------------
 * UC26 — divergência de pagamento, as DUAS direções
 * ---------------------------------------------------------------------- */

test.describe('UC26 — marcar um recorrente pago com valor diferente do previsto', () => {
  async function freshCategoryAndAccount(api: APIRequestContext) {
    const blocks = (await (await api.get('/api/v1/statement-blocks')).json()) as {
      data: readonly { id: string; acceptsUserCategories: boolean; effect: string }[]
    }
    // Deliberately `effect === 'Subtract'`, not just "the first block that
    // accepts user categories": `receita-bruta` accepts them too and is
    // FIRST by `order` (chart-of-accounts/types.ts), and `blockForRole`
    // (income-statement.ts) files an Expense's contribution under whatever
    // block its categoria points at, with no check that the category's own
    // `effect` agrees with the entry's `kind` — so picking blindly landed this
    // test's throwaway Expense inside `receita-bruta` and silently corrupted
    // every OTHER test in this file asserting July's Receita Bruta total.
    const block = blocks.data.find((b) => b.acceptsUserCategories && b.effect === 'Subtract')
    expect(block, 'at least one subtracting block accepts user categories').toBeDefined()

    const categoryResponse = await api.post('/api/v1/categories', {
      data: { blockId: block!.id, name: `e2e-uc26-${Date.now()}` },
    })
    expect(categoryResponse.status()).toBe(201)
    const category = (await categoryResponse.json()) as { id: string }

    const accountResponse = await api.post('/api/v1/bank-accounts', {
      data: { label: `e2e-uc26-${Date.now()}`, colour: 'nubank', entity: 'PF', balance: 0 },
    })
    expect(accountResponse.status()).toBe(201)
    const account = (await accountResponse.json()) as { id: string }

    return { categoryId: category.id, bankAccountId: account.id }
  }

  async function createRecurrenceOccurrence(
    api: APIRequestContext,
    plannedAmount: number,
  ): Promise<string> {
    const { categoryId, bankAccountId } = await freshCategoryAndAccount(api)
    const recurrenceResponse = await api.post('/api/v1/recurrences', {
      data: {
        template: {
          kind: 'Expense',
          amount: plannedAmount,
          entity: 'PF',
          categoryId,
          classification: 'Current',
          bankAccountId,
        },
        amountKind: 'Fixed',
        startDate: '2026-07-01',
      },
    })
    expect(recurrenceResponse.status()).toBe(201)
    const recurrence = (await recurrenceResponse.json()) as { id: string }

    const occurrences = (await (await api.get('/api/v1/occurrences?month=2026-07')).json()) as {
      data: readonly { id: string; recurrenceId: string; plannedAmount: number }[]
    }
    const occurrence = occurrences.data.find((o) => o.recurrenceId === recurrence.id)
    expect(occurrence, 'the series must produce a July occurrence').toBeDefined()
    expect(occurrence!.plannedAmount).toBe(plannedAmount)
    return occurrence!.id
  }

  test('pagar a MENOS cria uma Pendência de divergência (PRD §5, files_design/03 "Marcar Pago")', async ({
    request,
  }) => {
    const occurrenceId = await createRecurrenceOccurrence(request, 100_000)

    const payment = await request.post(`/api/v1/occurrences/${occurrenceId}/payment`, {
      data: { paidAmount: 80_000, paymentDate: '2026-07-20' },
    })
    expect(payment.status()).toBe(200)
    const paid = (await payment.json()) as { entryId: string }

    const pendingItems = (await (await request.get('/api/v1/pending-items')).json()) as {
      data: readonly {
        kind: string
        amount: number | null
        item: { origin?: { entryId?: string } }
      }[]
    }
    const discrepancy = pendingItems.data.find(
      (item) => item.kind === 'PaymentDiscrepancy' && item.item.origin?.entryId === paid.entryId,
    )
    expect(
      discrepancy,
      'an underpayment MUST always create a PaymentDiscrepancy pendência',
    ).toBeDefined()
    expect(discrepancy!.amount).toBe(20_000) // a diferença, não o valor pago
  })

  test('pagar a MAIS NUNCA cria Pendência (files_design/03 — a pessoa escolhe na hora)', async ({
    request,
  }) => {
    const occurrenceId = await createRecurrenceOccurrence(request, 100_000)

    const payment = await request.post(`/api/v1/occurrences/${occurrenceId}/payment`, {
      data: { paidAmount: 130_000, paymentDate: '2026-07-20' },
    })
    expect(payment.status()).toBe(200)
    const paid = (await payment.json()) as { entryId: string }

    const pendingItems = (await (await request.get('/api/v1/pending-items')).json()) as {
      data: readonly { kind: string; item: { origin?: { entryId?: string } } }[]
    }
    const discrepancy = pendingItems.data.find(
      (item) => item.kind === 'PaymentDiscrepancy' && item.item.origin?.entryId === paid.entryId,
    )
    expect(
      discrepancy,
      'an overpayment must NEVER create a PaymentDiscrepancy pendência',
    ).toBeUndefined()
  })
})

/* -------------------------------------------------------------------------
 * UC42 — indicador com denominador zero
 * ---------------------------------------------------------------------- */

test.describe('UC42 — um indicador sem base de cálculo aparece como null, nunca 0/NaN/campo ausente', () => {
  test('num mês sem nenhum lançamento, os indicadores de margem voltam null explícito no JSON', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/v1/reports/indicators?month=2020-01&view=Consolidated&statusFilter=Paid&asOf=2020-01-31',
    )
    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      profitability: readonly { key: string; value: number | null }[]
      liquidity: readonly { key: string; value: number | null }[]
    }

    const grossMargin = body.profitability.find((i) => i.key === 'grossMargin')
    expect(grossMargin, 'grossMargin must be present in the JSON, not omitted').toBeDefined()
    expect(grossMargin!.value).toBeNull()

    // Never NaN or Infinity anywhere in the payload — `JSON.stringify` turns
    // both into `null` on its own, so the ONLY safe proof is to inspect the
    // parsed numbers before they round-trip through JSON a second time.
    for (const indicator of [...body.profitability, ...body.liquidity]) {
      if (typeof indicator.value === 'number') {
        expect(Number.isFinite(indicator.value)).toBe(true)
      }
    }
  })
})

/* -------------------------------------------------------------------------
 * PRD v7 (A) — Consumo Livre nunca é ativo circulante
 * ---------------------------------------------------------------------- */

test.describe('PRD v7 (A) — Consumo Livre não é ativo circulante no Balanço Patrimonial', () => {
  test('um gasto de Consumo Livre não muda o Ativo Circulante do Balanço', async ({ request }) => {
    const before = await request.get(
      '/api/v1/reports/balance-sheet?view=Consolidated&asOf=2026-07-31',
    )
    expect(before.status()).toBe(200)
    const beforeBody = (await before.json()) as { currentAssets: { total: number } }

    const expense = await request.post('/api/v1/discretionary-spending/expenses', {
      data: { amount: 45_00, date: '2026-07-29' },
    })
    expect(expense.status()).toBe(201)

    const after = await request.get(
      '/api/v1/reports/balance-sheet?view=Consolidated&asOf=2026-07-31',
    )
    expect(after.status()).toBe(200)
    const afterBody = (await after.json()) as { currentAssets: { total: number } }

    // The account BALANCE is person-maintained, not derived from entries
    // (src/domain/reports/balance-sheet.ts header comment) — a Consumo Livre
    // gasto is a Lançamento, and the Balanço never reads a Lançamento at all.
    expect(afterBody.currentAssets.total).toBe(beforeBody.currentAssets.total)
  })
})

/* -------------------------------------------------------------------------
 * UC21-24 — cronograma de parcelas de um Passivo
 * ---------------------------------------------------------------------- */

test.describe('UC21-24 — cronograma de parcelas de um Passivo', () => {
  test('a soma das parcelas bate com o valor financiado, dentro de 1 centavo (juros 0%)', async ({
    request,
  }) => {
    // At 0% interest the Price schedule degenerates to principal / n exactly
    // (installments.ts `priceInstallmentFactor`'s own documented limit) — the
    // one rate at which "soma das parcelas == valor financiado" is literally
    // true instead of overstated by the interest a real financing schedule
    // always carries.
    const created = await request.post('/api/v1/liabilities', {
      data: {
        name: `e2e-uc21-${Date.now()}`,
        creditor: 'Credor de teste',
        entity: 'PF',
        classification: 'NonCurrent',
        originalAmount: 100_000_00,
        installmentAmount: 833_34,
        installmentCount: 12,
        installmentsAlreadyPaid: 0,
        monthlyInterestRate: 0,
        startDate: '2026-01-10',
      },
    })
    expect(created.status()).toBe(201)
    const liability = (await created.json()) as { id: string }

    const scheduleResponse = await request.get(`/api/v1/liabilities/${liability.id}/installments`)
    expect(scheduleResponse.status()).toBe(200)
    const schedule = (await scheduleResponse.json()) as {
      data: readonly { plannedAmount: number }[]
    }

    const total = schedule.data.reduce((sum, installment) => sum + installment.plannedAmount, 0)
    // "dentro de 1 centavo" — splitEvenly rounds the whole once and distributes
    // the remainder one cent at a time, so equality is exact here, and the
    // assertion still holds if that rounding strategy ever changes slightly.
    expect(Math.abs(total - 100_000_00)).toBeLessThanOrEqual(1)
  })

  test('uma parcela já paga NÃO muda de valor depois de um reajuste de juros registrado depois dela', async ({
    request,
  }) => {
    const liabilities = (await (await request.get('/api/v1/liabilities')).json()) as {
      data: readonly { id: string; name: string; monthlyInterestRate: number }[]
    }
    const mortgage = liabilities.data.find((l) => l.name === 'Financiamento apartamento')
    expect(mortgage, 'seed.ts must have created the Financiamento apartamento').toBeDefined()

    const before = (await (
      await request.get(`/api/v1/liabilities/${mortgage!.id}/installments`)
    ).json()) as {
      data: readonly {
        id: string
        number: number
        status: string
        plannedAmount: number
        paidAmount: number | null
      }[]
    }
    const paidBefore = before.data.filter((i) => i.status === 'Paid')
    expect(paidBefore.length).toBeGreaterThan(0)

    // An effective date at the very start of the loan: if "só as parcelas
    // ainda Previstas" were not honoured, EVERY installment — paid ones
    // included — would be recomputed by this adjustment.
    // Always strictly different from whatever rate is on file today, so
    // re-running this test against the same persisted database (it never
    // deletes the rate adjustment it registers) still produces a real change
    // to recompute — reusing a fixed literal risked reapplying the SAME rate
    // on a second run, which a correct re-amortisation leaves unchanged and
    // would make the "something must have changed" assertion below flaky.
    const newRate = mortgage!.monthlyInterestRate + 0.001
    const adjustment = await request.post(`/api/v1/liabilities/${mortgage!.id}/rate-adjustments`, {
      data: { newRate, effectiveFrom: '2025-08-10' },
    })
    expect(adjustment.status()).toBe(200)

    const after = (await (
      await request.get(`/api/v1/liabilities/${mortgage!.id}/installments`)
    ).json()) as {
      data: readonly {
        id: string
        number: number
        status: string
        plannedAmount: number
        paidAmount: number | null
      }[]
    }

    for (const paid of paidBefore) {
      const stillThere = after.data.find((i) => i.id === paid.id)
      expect(stillThere, `installment #${paid.number} must still exist`).toBeDefined()
      expect(stillThere!.status).toBe('Paid')
      expect(stillThere!.plannedAmount).toBe(paid.plannedAmount)
      expect(stillThere!.paidAmount).toBe(paid.paidAmount)
    }

    // And the adjustment DID do something — at least one still-Planned
    // installment changed, otherwise this test would pass even if the whole
    // rate-adjustment endpoint were a no-op.
    const plannedBefore = before.data.filter((i) => i.status === 'Planned')
    const changed = plannedBefore.some((installment) => {
      const now = after.data.find((i) => i.id === installment.id)
      return now !== undefined && now.plannedAmount !== installment.plannedAmount
    })
    expect(changed, 'at least one still-Planned installment must have been recalculated').toBe(true)
  })
})

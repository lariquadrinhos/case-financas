/**
 * Dados sintéticos de desenvolvimento — fidelidade ao dashboard da Home
 * (`docs/figma/frames/5-2__desktop-inicio-dashboard.xml`) mais as adições da
 * v7 (Passivo com cronograma completo, UC21-24; Consumo Livre com sobra do
 * mês anterior, UC32).
 *
 * 100% SINTÉTICO (ADR-0009 §"dados sensíveis"): todo nome, valor e conta abaixo
 * é inventado — não há pessoa, CPF/CNPJ, conta ou valor reais. `tools/audit.sh
 * lgpd` varre este arquivo à procura de CPF/CNPJ; não adicione nenhum.
 *
 * DETERMINÍSTICO: nenhuma linha aqui chama `Math.random()` nem `Date.now()`.
 * Toda data é um literal ISO explícito, ancorado no mês semente 2026-07 (PRD
 * v7, Figma 5:2). Os IDs que a própria camada de dados atribui (`randomUUID()`
 * dentro de cada `*.repository.ts`, convenção já usada em
 * `entries-test-fixtures.ts`) não são determinísticos linha a linha, mas o
 * CONTEÚDO gerado é sempre o mesmo — é por isso que `seed()` reseta os dados
 * do usuário antes de recriá-los (ver `resetUserData`), em vez de tentar
 * upsertar por uma chave natural que a maioria destas tabelas não tem.
 *
 * IDEMPOTENTE: rodar `seed()` duas vezes sobre o mesmo banco produz o mesmo
 * estado final (mesmas linhas, mesmos valores) — nunca duplica.
 */

import { eq } from 'drizzle-orm'

import {
  DEFAULT_BLOCKS,
  DEFAULT_CATEGORIES,
  type ChartOfAccounts,
} from '@/domain/chart-of-accounts'
import {
  ZERO,
  asId,
  cents,
  fromReais,
  isoDate,
  month,
  subtract,
  type BankAccountId,
  type CategoryId,
  type Cents,
  type InvestmentId,
  type IsoDate,
  type Month,
  type TraceEventId,
} from '@/domain/core'
import {
  buildInstallmentSchedule,
  liabilityRegisteredEvent,
  applyRateAdjustment,
  markInstallmentPaid,
  type RateAdjustment,
} from '@/domain/assets'
import { paymentOutcomeOf, type Entry } from '@/domain/entries'
import { computeIncomeStatement } from '@/domain/reports'
import { buildTraceEvent } from '@/domain/trace-events'
import { pendingItemFromPaymentOutcome } from '@/domain/pending-items'
import type { UserId } from '@/data/contracts/common'
import { createSqliteRepositories } from '@/data/sqlite'
import type { BigornaDatabase } from '@/data/sqlite/client'
import { schema } from '@/data/sqlite/schema'

/**
 * A mesma conta de desenvolvimento sem login de `src/server/session.ts`
 * (`DEVELOPMENT_USER`) e de `src/data/fixtures/test-repositories.ts`
 * (`TEST_USER_ID`) — os três precisam apontar para o mesmo id, senão o app
 * rodando com `npm run dev` (que sempre resolve para
 * `getSession().userId === 'development-user'`) não vê o que o seed escreveu.
 */
export const SEED_USER_ID = 'development-user' as UserId

/** O mês semente da v7 — Figma 5:2 é "Julho 2026". */
export const SEED_MONTH = month('2026-07')
const PRIOR_MONTHS: readonly Month[] = [month('2026-05'), month('2026-06')]
const ALL_SEEDED_MONTHS: readonly Month[] = [...PRIOR_MONTHS, SEED_MONTH]

export interface SeedSummary {
  readonly userId: UserId
  readonly months: readonly Month[]
  readonly bankAccounts: { readonly nubankPfId: BankAccountId; readonly itauPjId: BankAccountId }
  readonly investments: {
    readonly tesouroDiretoId: InvestmentId
    readonly acoesXpId: InvestmentId
  }
  /** O DRE consolidado de julho/2026, para quem chama `seed()` conferir sem reconsultar o banco. */
  readonly julyIncomeStatementNetProfit: Cents
}

/* -------------------------------------------------------------------------
 * Reinício idempotente
 *
 * Cada `create()` das camadas de dados atribui um id via `randomUUID()`
 * (convenção do projeto inteiro — ver o comentário de topo de
 * `src/data/sqlite/entries.repository.ts` e das demais). Rodar `seed()` duas
 * vezes chamando `create()` de novo duplicaria toda linha; a alternativa —
 * upsertar por nome — não funciona porque a maioria destas tabelas não tem
 * chave natural (duas contas bancárias podem legitimamente ter o mesmo rótulo).
 * A saída é apagar tudo que pertence a este usuário, na ordem que respeita as
 * chaves estrangeiras ON DELETE RESTRICT de `schema.ts` (filho antes do pai),
 * e reconstruir do zero. `users` fica de fora: é a única linha que precisa
 * sobreviver a um reseed (nada mais referencia nada fora do escopo do usuário).
 * ---------------------------------------------------------------------- */
function resetUserData(db: BigornaDatabase, userId: UserId): void {
  db.transaction((tx) => {
    tx.delete(schema.onboardingProgress).where(eq(schema.onboardingProgress.userId, userId)).run()
    tx.delete(schema.discretionaryExpenses)
      .where(eq(schema.discretionaryExpenses.userId, userId))
      .run()
    tx.delete(schema.allocationItems).where(eq(schema.allocationItems.userId, userId)).run()
    tx.delete(schema.pendingAllocations).where(eq(schema.pendingAllocations.userId, userId)).run()
    tx.delete(schema.paymentDiscrepancies)
      .where(eq(schema.paymentDiscrepancies.userId, userId))
      .run()
    tx.delete(schema.traceEvents).where(eq(schema.traceEvents.userId, userId)).run()
    tx.delete(schema.occurrences).where(eq(schema.occurrences.userId, userId)).run()
    tx.delete(schema.entries).where(eq(schema.entries.userId, userId)).run()
    tx.delete(schema.discretionarySpendingConfig)
      .where(eq(schema.discretionarySpendingConfig.userId, userId))
      .run()
    tx.delete(schema.profitAllocations).where(eq(schema.profitAllocations.userId, userId)).run()
    tx.delete(schema.recurrences).where(eq(schema.recurrences.userId, userId)).run()
    tx.delete(schema.rateAdjustments).where(eq(schema.rateAdjustments.userId, userId)).run()
    tx.delete(schema.installments).where(eq(schema.installments.userId, userId)).run()
    tx.delete(schema.liabilities).where(eq(schema.liabilities.userId, userId)).run()
    tx.delete(schema.investments).where(eq(schema.investments.userId, userId)).run()
    tx.delete(schema.tangibleAssets).where(eq(schema.tangibleAssets.userId, userId)).run()
    tx.delete(schema.bankAccounts).where(eq(schema.bankAccounts.userId, userId)).run()
    tx.delete(schema.categories).where(eq(schema.categories.userId, userId)).run()
    tx.delete(schema.statementBlocks).where(eq(schema.statementBlocks.userId, userId)).run()
  })
}

function ensureUserRow(db: BigornaDatabase, userId: UserId): void {
  db.insert(schema.users)
    .values({ id: userId, createdAt: '2025-01-01' })
    .onConflictDoNothing()
    .run()
}

const cat = (id: string): CategoryId => asId<CategoryId>(id)

/**
 * Popula `db` com o cenário sintético da Home (Figma 5:2) para `userId`.
 *
 * Chame contra `openDatabase()` (arquivo real) a partir de `scripts/seed.ts`,
 * ou contra `createInMemoryDatabase()` num teste. Nunca lê relógio nem gera
 * número aleatório — todo valor abaixo é um literal.
 */
export async function seed(db: BigornaDatabase, userId: UserId): Promise<SeedSummary> {
  ensureUserRow(db, userId)
  resetUserData(db, userId)

  const repos = createSqliteRepositories(db)
  const {
    statementBlockWriter,
    categoryWriter,
    bankAccountWriter,
    investmentWriter,
    tangibleAssetWriter,
    pendingAllocationWriter,
    liabilityWriter,
    installmentWriter,
    rateAdjustmentWriter,
    traceEventWriter,
    recurrenceWriter,
    occurrenceWriter,
    entryWriter,
    paymentDiscrepancyWriter,
    discretionarySpendingConfigWriter,
    discretionaryExpenseWriter,
    profitAllocationWriter,
  } = repos

  /* -----------------------------------------------------------------------
   * 1. Plano de contas — o modelo de referência do PRD, sem edição.
   * -------------------------------------------------------------------- */
  await statementBlockWriter.seed(userId, DEFAULT_BLOCKS)
  await categoryWriter.seed(userId, DEFAULT_CATEGORIES)
  const chart: ChartOfAccounts = { blocks: DEFAULT_BLOCKS, categories: DEFAULT_CATEGORIES }

  /* -----------------------------------------------------------------------
   * 2. Contas bancárias — Figma 5:2 "Onde Está Meu Dinheiro":
   *    Nubank (PF) R$ 179.600,00 · Itaú PJ R$ 50.000,00.
   * -------------------------------------------------------------------- */
  const nubankPf = await bankAccountWriter.create(userId, {
    label: 'Nubank',
    colour: 'nubank',
    entity: 'PF',
    balance: fromReais(179_600),
  })
  const itauPj = await bankAccountWriter.create(userId, {
    label: 'Itaú PJ',
    colour: 'itau',
    entity: 'PJ',
    balance: fromReais(50_000),
  })

  /* -----------------------------------------------------------------------
   * 3. Investimentos — Figma 5:2 "Investimentos R$ 22.000,00 · Tesouro, ações".
   * -------------------------------------------------------------------- */
  const tesouroDireto = await investmentWriter.create(userId, {
    name: 'Tesouro Direto',
    entity: 'PF',
    accumulatedValue: fromReais(15_000),
  })
  const acoesXp = await investmentWriter.create(userId, {
    name: 'Ações XP',
    entity: 'PF',
    accumulatedValue: fromReais(7_000),
  })

  /* -----------------------------------------------------------------------
   * 4. Bem Material vendido com saldo sem destino — Pendência #1 da Home
   *    ("R$ 5.000,00 aguardando direcionamento / Venda de Civic 2020").
   *    A rota real (`POST /tangible-assets/{id}/sale`) não gera lançamento de
   *    ganho/perda automaticamente (H12, decisão de arquitetura em aberto) —
   *    o seed reproduz exatamente o que ela faz, nada além.
   * -------------------------------------------------------------------- */
  const civic = await tangibleAssetWriter.create(userId, {
    name: 'Civic 2020',
    entity: 'PF',
    recordedValue: fromReais(60_000),
  })
  await tangibleAssetWriter.replace(userId, { ...civic, soldOn: isoDate('2026-07-12') })
  await pendingAllocationWriter.create(userId, {
    origin: { kind: 'TangibleAssetSale', tangibleAssetId: civic.id },
    amount: fromReais(5_000),
    originDate: isoDate('2026-07-12'),
    status: 'Pending',
  })

  /* -----------------------------------------------------------------------
   * 5. Passivo com cronograma completo — UC21-24, Figma "Eventos Recentes"
   *    (150:6-150:20): financiamento apartamento R$ 320.000,00, 360 parcelas,
   *    taxa inicial 0,80% a.m. (texto literal do evento de cadastro),
   *    reajustada para 0,85% a.m. em 05/06/2026; parcela #11 paga em
   *    10/06/2026 sem divergência, #12 paga em 10/07/2026 com divergência.
   *
   *    `startDate` é escolhido para que a data PREVISTA da parcela #11 caia
   *    exatamente em 10/06/2026 e a da #12 em 10/07/2026 (mesma regra de
   *    `sameDayInAnotherMonth` que o motor usa): 2025-08-10 + 10 meses =
   *    2026-06-10; + 11 meses = 2026-07-10.
   *
   *    `installmentsAlreadyPaid: 1` (só a #1, cuja data prevista É a própria
   *    `startDate`, 5 dias antes do cadastro) é deliberado, não um resquício:
   *    qualquer `startDate` que faça a #11 cair em 10/06/2026 força a #2 a
   *    vencer em 2025-09-10, DEPOIS do cadastro (15/08/2025) — não é uma
   *    parcela "já paga" nesse ponto. As parcelas #2-#10 ficam Previstas
   *    (vencidas) de propósito: é exatamente o caso "parcela atrasada ainda
   *    Previsto" que a Revisão de Recorrentes precisa saber mostrar, e evita
   *    gerar 9 eventos extras de "Parcela paga" que empurrariam o cadastro
   *    (15/08/2025) para fora dos 5 Eventos Recentes da Home.
   * -------------------------------------------------------------------- */
  const liabilityDraft = {
    name: 'Financiamento apartamento',
    creditor: 'Caixa Econômica Federal',
    entity: 'PF' as const,
    classification: 'NonCurrent' as const,
    originalAmount: fromReais(320_000),
    // Declarado pela pessoa no formulário; o cronograma real é CALCULADO por
    // amortização e não usa este campo — escolha de produto registrada na nota
    // de design `164:2` (P3a, src/domain/assets/installments.ts).
    installmentAmount: fromReais(2_700),
    installmentCount: 360,
    installmentsAlreadyPaid: 1,
    monthlyInterestRate: 0.008,
    startDate: isoDate('2025-08-10'),
  }
  const liability = await liabilityWriter.create(userId, liabilityDraft)

  let schedule = buildInstallmentSchedule(liability)
  await installmentWriter.replaceSchedule(userId, liability.id, schedule)
  await traceEventWriter.append(userId, liabilityRegisteredEvent(liability, isoDate('2025-08-15')))

  const adjustment: RateAdjustment = {
    liabilityId: liability.id,
    newRate: 0.0085,
    effectiveFrom: isoDate('2026-06-05'),
  }
  const adjustmentResult = applyRateAdjustment(
    liability,
    schedule,
    adjustment,
    isoDate('2026-06-05'),
  )
  schedule = [...adjustmentResult.installments]
  await rateAdjustmentWriter.append(userId, adjustment)
  await liabilityWriter.replace(userId, adjustmentResult.liability)
  await installmentWriter.replaceSchedule(userId, liability.id, schedule)
  await traceEventWriter.append(userId, adjustmentResult.event)

  const installment11 = schedule.find((item) => item.number === 11)
  if (installment11 === undefined) throw new Error('seed.installment_11_missing')
  const paid11 = markInstallmentPaid(
    installment11,
    installment11.plannedAmount,
    isoDate('2026-06-10'),
  )
  await installmentWriter.replace(userId, paid11.installment)
  await traceEventWriter.append(userId, paid11.event)

  const installment12 = schedule.find((item) => item.number === 12)
  if (installment12 === undefined) throw new Error('seed.installment_12_missing')
  // Diverge por R$ 20,00 a mais, no mesmo espírito do exemplo de
  // files_design/03 ("previsto R$ 1.520,00, pago R$ 1.540,00").
  const paidAmount12 = cents(installment12.plannedAmount + 2_000)
  const paid12 = markInstallmentPaid(installment12, paidAmount12, isoDate('2026-07-10'))
  await installmentWriter.replace(userId, paid12.installment)
  await traceEventWriter.append(userId, paid12.event)

  /* -----------------------------------------------------------------------
   * 6. Recorrências
   *    a) Aluguel — Fixo, paga em maio e junho sem divergência, e em julho
   *       com divergência (Pendência #4 + Evento #5, files_design/03
   *       "Marcar Pago", Figma 150:7-8).
   *    b) Internet e Contador — A definir, sem valor em julho (Pendência #2,
   *       "2 recorrentes pendentes este mês").
   * -------------------------------------------------------------------- */
  const aluguelCategoryId = cat('aluguel-moradia')
  const aluguelRecurrence = await recurrenceWriter.create(userId, {
    template: {
      kind: 'Expense',
      amount: fromReais(1_500),
      entity: 'PF',
      categoryId: aluguelCategoryId,
      classification: 'Current',
      bankAccountId: nubankPf.id,
    },
    amountKind: 'Fixed',
    startDate: isoDate('2025-01-05'),
    endsOn: null,
  })

  async function payAluguelExact(occurrenceMonth: Month, date: IsoDate): Promise<void> {
    const entry = await entryWriter.create(userId, {
      kind: 'Expense',
      amount: fromReais(1_500),
      date,
      status: 'Paid',
      recurrenceId: aluguelRecurrence.id,
      entity: 'PF',
      categoryId: aluguelCategoryId,
      classification: 'Current',
      bankAccountId: nubankPf.id,
    })
    await occurrenceWriter.create(userId, {
      recurrenceId: aluguelRecurrence.id,
      month: occurrenceMonth,
      plannedDate: date,
      plannedAmount: fromReais(1_500),
      status: 'Paid',
      discarded: false,
      entryId: entry.id,
    })
  }
  await payAluguelExact(month('2026-05'), isoDate('2026-05-05'))
  await payAluguelExact(month('2026-06'), isoDate('2026-06-05'))

  // Julho: pago a menos — R$ 200,00 pendentes (Figma 151:4-5, Pendência #4) e
  // o Evento de divergência (Figma 150:8, Evento #1 — o mais recente dos 5).
  const aluguelJulyPlanned = fromReais(1_500)
  const aluguelJulyPaid = fromReais(1_300)
  const aluguelJulyEntry = await entryWriter.create(userId, {
    kind: 'Expense',
    amount: aluguelJulyPaid,
    date: isoDate('2026-07-20'),
    status: 'Paid',
    recurrenceId: aluguelRecurrence.id,
    entity: 'PF',
    categoryId: aluguelCategoryId,
    classification: 'Current',
    bankAccountId: nubankPf.id,
  })
  await occurrenceWriter.create(userId, {
    recurrenceId: aluguelRecurrence.id,
    month: SEED_MONTH,
    plannedDate: isoDate('2026-07-05'),
    plannedAmount: aluguelJulyPaid,
    status: 'Paid',
    discarded: false,
    entryId: aluguelJulyEntry.id,
  })
  const aluguelOutcome = paymentOutcomeOf(aluguelJulyPaid, aluguelJulyPlanned)
  const aluguelRecurrenceOrigin = {
    kind: 'Recurrence' as const,
    recurrenceId: aluguelRecurrence.id,
  }
  const discrepancyEvent = buildTraceEvent('Discrepancy', aluguelRecurrenceOrigin, {
    // Descartado por `buildTraceEvent` — o id real é atribuído por
    // `traceEventWriter.append` a seguir, mesmo padrão do payload de
    // `POST /occurrences/{id}/payment`.
    id: asId<TraceEventId>('seed-discard'),
    date: isoDate('2026-07-20'),
    subject: 'Aluguel',
    plannedAmount: aluguelJulyPlanned,
    paidAmount: aluguelJulyPaid,
  })
  await traceEventWriter.append(userId, discrepancyEvent)
  if (aluguelOutcome.kind === 'Underpaid') {
    const newDiscrepancy = pendingItemFromPaymentOutcome(
      aluguelOutcome,
      { kind: 'Entry', entryId: aluguelJulyEntry.id },
      isoDate('2026-07-20'),
    )
    if (newDiscrepancy !== null) {
      await paymentDiscrepancyWriter.create(userId, newDiscrepancy)
    }
  }

  const internetCategoryId = cat('infraestrutura-internet')
  const internetRecurrence = await recurrenceWriter.create(userId, {
    template: {
      kind: 'Expense',
      amount: ZERO,
      entity: 'PJ',
      categoryId: internetCategoryId,
      classification: 'Current',
      bankAccountId: itauPj.id,
    },
    amountKind: 'ToBeDefined',
    startDate: isoDate('2026-01-10'),
    endsOn: null,
  })
  await occurrenceWriter.create(userId, {
    recurrenceId: internetRecurrence.id,
    month: SEED_MONTH,
    plannedDate: isoDate('2026-07-10'),
    plannedAmount: null,
    status: 'Planned',
    discarded: false,
    entryId: null,
  })

  const contadorCategoryId = cat('contador-assessoria')
  const contadorRecurrence = await recurrenceWriter.create(userId, {
    template: {
      kind: 'Expense',
      amount: ZERO,
      entity: 'PJ',
      categoryId: contadorCategoryId,
      classification: 'Current',
      bankAccountId: itauPj.id,
    },
    amountKind: 'ToBeDefined',
    startDate: isoDate('2026-01-15'),
    endsOn: null,
  })
  await occurrenceWriter.create(userId, {
    recurrenceId: contadorRecurrence.id,
    month: SEED_MONTH,
    plannedDate: isoDate('2026-07-15'),
    plannedAmount: null,
    status: 'Planned',
    discarded: false,
    entryId: null,
  })

  /* -----------------------------------------------------------------------
   * 7. Lançamentos avulsos de maio, junho e julho — receita, pró-labore,
   *    despesas administrativas/pessoais e IR. Maio e junho existem só para
   *    a Evolução Mensal ter série real (files_design/01 §8.3: "mostra
   *    apenas os meses com dado real"); julho reproduz Figma 5:2 exatamente:
   *    Receita do Mês R$ 24.400,00 (visão PF — Salário 18.000 + Pró-labore
   *    4.000 + Outras receitas 2.400), Despesas Administrativas R$ 6.500,00
   *    e Despesas Pessoais R$ 5.200,00 (block da cascata, com Consumo Livre
   *    dentro), Impostos R$ 3.200,00.
   * -------------------------------------------------------------------- */
  interface MonthPlan {
    readonly revenueDate: IsoDate
    readonly salario: number
    readonly outrasReceitas: number
    readonly proLabore: number
    readonly admin: Record<string, number>
    readonly pessoais: Record<string, number>
    readonly ir: number
  }

  const monthPlans: readonly MonthPlan[] = [
    {
      revenueDate: isoDate('2026-05-05'),
      salario: 18_000,
      outrasReceitas: 2_000,
      proLabore: 4_000,
      admin: {
        'plano-de-saude': 2_500,
        agua: 300,
        luz: 400,
        educacao: 1_000,
        'outras-despesas-administrativas': 1_000,
      },
      pessoais: {
        alimentacao: 1_700,
        transporte: 800,
        'lazer-entretenimento': 600,
        vestuario: 500,
        'outras-despesas-pessoais': 700,
      },
      ir: 3_000,
    },
    {
      revenueDate: isoDate('2026-06-05'),
      salario: 18_000,
      outrasReceitas: 2_200,
      proLabore: 4_000,
      admin: {
        'plano-de-saude': 2_500,
        agua: 320,
        luz: 420,
        educacao: 1_000,
        'outras-despesas-administrativas': 1_100,
      },
      pessoais: {
        alimentacao: 1_750,
        transporte: 850,
        'lazer-entretenimento': 650,
        vestuario: 550,
        'outras-despesas-pessoais': 750,
      },
      ir: 3_100,
    },
    {
      revenueDate: isoDate('2026-07-05'),
      salario: 18_000,
      outrasReceitas: 2_400,
      proLabore: 4_000,
      admin: {
        'plano-de-saude': 2_500,
        agua: 300,
        luz: 400,
        educacao: 1_000,
        'outras-despesas-administrativas': 1_000,
      },
      pessoais: {
        alimentacao: 1_800,
        transporte: 900,
        'lazer-entretenimento': 700,
        vestuario: 650,
        'outras-despesas-pessoais': 800,
      },
      ir: 3_200,
    },
  ]

  const julyEntries: Entry[] = []

  for (const plan of monthPlans) {
    await entryWriter.create(userId, {
      kind: 'Revenue',
      amount: fromReais(plan.salario),
      date: plan.revenueDate,
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: cat('salario-pro-labore'),
      classification: 'Current',
      bankAccountId: nubankPf.id,
    })
    await entryWriter.create(userId, {
      kind: 'Revenue',
      amount: fromReais(plan.outrasReceitas),
      date: plan.revenueDate,
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: cat('outras-receitas-operacionais'),
      classification: 'Current',
      bankAccountId: nubankPf.id,
    })
    await entryWriter.create(userId, {
      kind: 'ProLabore',
      amount: fromReais(plan.proLabore),
      date: plan.revenueDate,
      status: 'Paid',
      recurrenceId: null,
      sourceAccountId: itauPj.id,
      destinationAccountId: nubankPf.id,
    })

    for (const [categoryId, amount] of Object.entries(plan.admin)) {
      await entryWriter.create(userId, {
        kind: 'Expense',
        amount: fromReais(amount),
        date: plan.revenueDate,
        status: 'Paid',
        recurrenceId: null,
        entity: 'PF',
        categoryId: cat(categoryId),
        classification: 'Current',
        bankAccountId: nubankPf.id,
      })
    }
    for (const [categoryId, amount] of Object.entries(plan.pessoais)) {
      await entryWriter.create(userId, {
        kind: 'Expense',
        amount: fromReais(amount),
        date: plan.revenueDate,
        status: 'Paid',
        recurrenceId: null,
        entity: 'PF',
        categoryId: cat(categoryId),
        classification: 'Current',
        bankAccountId: nubankPf.id,
      })
    }
    await entryWriter.create(userId, {
      kind: 'IncomeTax',
      amount: fromReais(plan.ir),
      date: plan.revenueDate,
      status: 'Paid',
      recurrenceId: null,
      direction: 'Payment',
      entity: 'PF',
      bankAccountId: nubankPf.id,
      label: null,
    })
  }

  /* -----------------------------------------------------------------------
   * 8. Consumo Livre — verba R$ 500,00/mês, saindo do Nubank (Figma 5:2
   *    "Saindo da conta Nubank · reabastece dia 1"). Maio gasta menos que a
   *    verba (R$ 370,00 de R$ 500,00) de propósito: é o dado bruto que
   *    demonstra "sobra do mês anterior" (UC32) — não há, hoje, nenhuma
   *    tabela ou campo que armazene a sobra em si (P14/P15,
   *    `docs/PERGUNTAS-EM-ABERTO.md`; `src/domain/discretionary-spending/
   *    types.ts` documenta a mesma lacuna), então o que o seed pode oferecer
   *    é exatamente isto: um mês cujo gasto real fica abaixo da verba, pronto
   *    para uma tela futura derivar `previousLeftover` a partir dele. Julho
   *    fecha em R$ 350,00 de R$ 500,00 — o número exato do widget na Home.
   * -------------------------------------------------------------------- */
  await discretionarySpendingConfigWriter.save(userId, {
    monthlyAmount: fromReais(500),
    sourceAccountId: nubankPf.id,
    entity: 'PF',
  })

  const discretionaryExpenses: readonly { readonly date: IsoDate; readonly amountReais: number }[] =
    [
      { date: isoDate('2026-05-08'), amountReais: 150 },
      { date: isoDate('2026-05-15'), amountReais: 120 },
      { date: isoDate('2026-05-22'), amountReais: 100 },
      { date: isoDate('2026-06-05'), amountReais: 200 },
      { date: isoDate('2026-06-12'), amountReais: 150 },
      { date: isoDate('2026-06-19'), amountReais: 80 },
      { date: isoDate('2026-06-26'), amountReais: 50 },
      { date: isoDate('2026-07-03'), amountReais: 120 },
      { date: isoDate('2026-07-10'), amountReais: 80 },
      { date: isoDate('2026-07-17'), amountReais: 90 },
      { date: isoDate('2026-07-24'), amountReais: 60 },
    ]
  for (const expense of discretionaryExpenses) {
    await discretionaryExpenseWriter.create(userId, {
      date: expense.date,
      amount: fromReais(expense.amountReais),
      label: null,
    })
  }

  /* -----------------------------------------------------------------------
   * 9. Destinar o Lucro — julho fecha com R$ 3.000,00 não alocados
   *    (Pendência #3, Figma 115:19-20 "R$ 3.000,00 do lucro de Julho não
   *    alocado / Destinação do lucro ficou incompleta"). O alvo é calculado a
   *    partir do LUCRO LÍQUIDO REAL de julho (via `computeIncomeStatement`,
   *    não um número chutado): isso é o que este arquivo prova ao final, e é
   *    também por que a Pendência bate mesmo que uma categoria acima mude de
   *    valor amanhã.
   * -------------------------------------------------------------------- */
  // Consultado de volta pelo próprio repositório (não os objetos que `create`
  // devolveu em memória) — a mesma leitura que uma rota real faria.
  julyEntries.push(...(await repos.entryReader.listByMonth(userId, SEED_MONTH)))

  const julyStatement = computeIncomeStatement({
    entries: julyEntries,
    chart,
    view: 'Consolidated',
    month: SEED_MONTH,
    statusFilter: 'Paid',
  })

  const unallocatedTarget = fromReais(3_000)
  const toAllocate = subtract(julyStatement.netProfit, unallocatedTarget)
  const cashReserveAmount = fromReais(1_000)
  const investmentAmount = subtract(toAllocate, cashReserveAmount)
  if (investmentAmount < ZERO) {
    // Guarda de sanidade: se as receitas/despesas acima mudarem e o lucro cair
    // abaixo de R$ 4.000,00, esta divisão fixa deixaria de fazer sentido —
    // falhar alto é melhor que uma Pendência com valor negativo no banco.
    throw new Error('seed.july_net_profit_too_low_for_allocation')
  }

  await profitAllocationWriter.save(userId, {
    month: SEED_MONTH,
    netProfit: julyStatement.netProfit,
    items: {
      InvestmentContribution: [
        {
          destination: { kind: 'Investment', investmentId: tesouroDireto.id },
          amount: investmentAmount,
        },
      ],
      DividendReinvestment: [],
      ExtraordinaryConsumption: [],
      CashReserve: [
        {
          destination: { kind: 'BankAccount', bankAccountId: nubankPf.id },
          amount: cashReserveAmount,
        },
      ],
    },
  })

  /* -----------------------------------------------------------------------
   * 13. Progresso do Onboarding — o cenário sintético é o de quem JÁ passou
   *     pelo fluxo: tem plano de contas, contas, bens, investimentos e
   *     passivos. Sem esta linha a abertura do app (files_design/01 §1,
   *     `src/app/page.tsx`) mandaria um banco recém-semeado para o Onboarding
   *     0, porque o estado que ela lê são os eventos "Fazer depois" (Figma
   *     116:11), "Salvar e continuar depois" (29:36) e "Concluir" (29:235) —
   *     nenhum deles disparado por um seed.
   * -------------------------------------------------------------------- */
  await repos.onboardingProgressWriter.save(userId, { status: 'Completed', lastStep: 5 })

  return {
    userId,
    months: ALL_SEEDED_MONTHS,
    bankAccounts: { nubankPfId: nubankPf.id, itauPjId: itauPj.id },
    investments: { tesouroDiretoId: tesouroDireto.id, acoesXpId: acoesXp.id },
    julyIncomeStatementNetProfit: julyStatement.netProfit,
  }
}

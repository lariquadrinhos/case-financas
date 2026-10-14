/**
 * Evento de rastreabilidade — SQLite adapter tests.
 *
 * Append-only (files_design/03: "a pessoa não edita o histórico"), so
 * `describeCrudContract` does not apply here — there is no `replace`, no
 * `remove` and no `findById`-after-create identity to prove beyond what the
 * tests below already cover directly against the port.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { isoDate } from '@/domain/core'
import { asId, type LiabilityId, type RecurrenceId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import { createTraceEventRepository } from './trace-events.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId
const USER_B = 'user-b' as UserId
const LIABILITY = asId<LiabilityId>('financiamento-apartamento')
const OTHER_LIABILITY = asId<LiabilityId>('financiamento-carro')
const RECURRENCE = asId<RecurrenceId>('aluguel')

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

function seedLiability(connection: BetterSqlite3.Database, userId: UserId, id: LiabilityId): void {
  connection
    .prepare(
      `insert into liabilities
         (user_id, id, name, creditor, entity, classification, original_amount,
          installment_amount, installment_count, installments_already_paid,
          monthly_interest_rate, start_date)
       values (?, ?, 'Financiamento', 'Banco', 'PF', 'NonCurrent', 32000000, 152000, 360, 0, 0.008, '2026-01-10')`,
    )
    .run(userId, id)
}

/**
 * A minimal Recorrência for `listByRecurrence`. `recurrences_template_categorized_shape`
 * (schema.ts) requires a real category and a real bank account for an 'Expense'
 * template — both seeded here rather than left NULL, which the CHECK refuses.
 */
function seedRecurrence(
  connection: BetterSqlite3.Database,
  userId: UserId,
  id: RecurrenceId,
): void {
  connection
    .prepare(
      `insert into statement_blocks
         (user_id, id, name, sort_order, effect, below_the_line, accepts_user_categories)
       values (?, 'block-1', 'Despesas Pessoais', 1, 'Subtract', 0, 1)`,
    )
    .run(userId)
  connection
    .prepare(
      `insert into categories (user_id, id, block_id, name) values (?, 'category-1', 'block-1', 'Aluguel')`,
    )
    .run(userId)
  connection
    .prepare(
      `insert into bank_accounts (user_id, id, label, colour, entity, balance)
       values (?, 'account-1', 'Nubank', 'nubank', 'PF', 500000)`,
    )
    .run(userId)
  connection
    .prepare(
      `insert into recurrences
         (user_id, id, amount_kind, start_date, ends_on, closed_on,
          template_kind, template_amount, template_entity, template_category_id,
          template_classification, template_bank_account_id)
       values (?, ?, 'Fixed', '2026-01-10', NULL, NULL, 'Expense', 150000, 'PF', 'category-1', 'Current', 'account-1')`,
    )
    .run(userId, id)
}

let db: BigornaDatabase
let connection: BetterSqlite3.Database

beforeEach(() => {
  const opened = createInMemoryDatabase()
  db = opened.db
  connection = opened.connection
  seedUser(connection, USER_A)
  seedUser(connection, USER_B)
  seedLiability(connection, USER_A, LIABILITY)
  seedLiability(connection, USER_A, OTHER_LIABILITY)
})

afterEach(() => {
  connection.close()
})

describe('TraceEvent repository — sqlite', () => {
  it('appends an event and assigns the id — the caller never supplies one', async () => {
    const { writer, reader } = createTraceEventRepository(db)
    const stored = await writer.append(USER_A, {
      date: isoDate('2026-01-10'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: LIABILITY },
      description: 'Financiamento cadastrado: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m.',
    })

    expect(await reader.findById(USER_A, stored.id)).toEqual(stored)
  })

  it('listRecent reads newest first (files_design/03, "Eventos Recentes")', async () => {
    const { writer, reader } = createTraceEventRepository(db)
    const first = await writer.append(USER_A, {
      date: isoDate('2026-01-10'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: LIABILITY },
      description: 'Financiamento cadastrado',
    })
    const second = await writer.append(USER_A, {
      date: isoDate('2026-02-10'),
      kind: 'InstallmentPaid',
      origin: { kind: 'Liability', liabilityId: LIABILITY },
      description: 'Parcela #1 paga: valor conforme previsto',
    })

    expect(await reader.listRecent(USER_A)).toEqual([second, first])
  })

  it('listRecent respects a page limit — the Home card takes only the first 5', async () => {
    const { writer, reader } = createTraceEventRepository(db)
    for (let i = 0; i < 7; i += 1) {
      await writer.append(USER_A, {
        date: isoDate(`2026-0${(i % 9) + 1}-10`),
        kind: 'RateAdjustment',
        origin: { kind: 'Liability', liabilityId: LIABILITY },
        description: `Reajuste #${i}`,
      })
    }
    expect(await reader.listRecent(USER_A, { limit: 5, offset: 0 })).toHaveLength(5)
  })

  it('listByLiability scopes to one Passivo — the Detalhe do Passivo log', async () => {
    const { writer, reader } = createTraceEventRepository(db)
    const mine = await writer.append(USER_A, {
      date: isoDate('2026-01-10'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: LIABILITY },
      description: 'Financiamento cadastrado',
    })
    await writer.append(USER_A, {
      date: isoDate('2026-01-11'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: OTHER_LIABILITY },
      description: 'Financiamento carro cadastrado',
    })

    expect(await reader.listByLiability(USER_A, LIABILITY)).toEqual([mine])
  })

  /**
   * A PRIMEIRA das cinco linhas do card "Eventos Recentes" da Home é um evento
   * cuja origem é uma RECORRÊNCIA, não um Passivo: Figma, página Wireframe,
   * `150:8` dentro do card `150:2` (frame `5:2` "Desktop — Início (Dashboard)",
   * docs/figma/frames/5-2__desktop-inicio-dashboard.xml) — "Aluguel pago com
   * divergência: previsto R$ 1.500,00, pago R$ 1.300,00 (R$ 200,00 pendente)".
   * "Aluguel" é a recorrência do produto (`10:30`/`10:31` na Revisão de
   * Recorrentes), e a frase é o resultado literal da ação ④ do frame `34:2`.
   * A página Mockup repete em `549:282`, dentro do card `549:276`.
   *
   * Este teste existe porque um comentário errado em `trace-events/route.ts` e
   * três documentos afirmavam que "nenhuma fonte descreve a tela" de um evento
   * com origem em Recorrência (P19) — leitura que convida a filtrar essas
   * origens fora de `listRecent` como órfãs. Elas são a linha 1 da Home.
   */
  it('listRecent traz o evento de origem Recorrência — é a 1ª linha da Home (Figma 150:8)', async () => {
    seedRecurrence(connection, USER_A, RECURRENCE)
    const { writer, reader } = createTraceEventRepository(db)
    await writer.append(USER_A, {
      date: isoDate('2026-06-10'),
      kind: 'InstallmentPaid',
      origin: { kind: 'Liability', liabilityId: LIABILITY },
      description: 'Parcela #11 paga: valor conforme previsto',
    })
    const fromRecurrence = await writer.append(USER_A, {
      date: isoDate('2026-07-20'),
      kind: 'Discrepancy',
      origin: { kind: 'Recurrence', recurrenceId: RECURRENCE },
      description:
        'Aluguel pago com divergência: previsto R$ 1.500,00, pago R$ 1.300,00 (R$ 200,00 pendente)',
    })

    const recent = await reader.listRecent(USER_A, { limit: 5, offset: 0 })

    expect(recent[0]).toEqual(fromRecurrence)
  })

  it('listByRecurrence scopes to one Recorrência', async () => {
    seedRecurrence(connection, USER_A, RECURRENCE)
    const { writer, reader } = createTraceEventRepository(db)
    const event = await writer.append(USER_A, {
      date: isoDate('2026-01-10'),
      kind: 'Discrepancy',
      origin: { kind: 'Recurrence', recurrenceId: RECURRENCE },
      description:
        'Aluguel pago com divergência: previsto R$ 1.500,00, pago R$ 1.300,00 (R$ 200,00 pendente)',
    })

    expect(await reader.listByRecurrence(USER_A, RECURRENCE)).toEqual([event])
  })

  it('ADR-0008 §3 — never returns another user’s events', async () => {
    const { writer, reader } = createTraceEventRepository(db)
    const mine = await writer.append(USER_A, {
      date: isoDate('2026-01-10'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: LIABILITY },
      description: 'Financiamento cadastrado',
    })

    expect(await reader.findById(USER_B, mine.id)).toBeNull()
    expect(await reader.listRecent(USER_B)).toEqual([])
  })

  it('answers null for an id that does not exist, instead of throwing', async () => {
    const { reader } = createTraceEventRepository(db)
    expect(await reader.findById(USER_A, asId('does-not-exist'))).toBeNull()
  })
})

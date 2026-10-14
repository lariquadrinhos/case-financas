/**
 * The database defends itself.
 *
 * These tests do not exercise a repository — there is none yet. They exercise
 * the SCHEMA: the CHECK constraints and the composite foreign keys, through raw
 * SQL, which is exactly the path that bypasses the TypeScript types. The
 * compiler protects the domain; this file is the evidence that the database
 * protects itself when a migration script, a `sqlite3` prompt or a future
 * adapter gets it wrong.
 *
 * Each test was seen failing with the constraint removed before being committed
 * (CLAUDE.md §7.1, rule 2).
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInMemoryDatabase } from './client'

let connection: BetterSqlite3.Database

function run(sql: string): void {
  connection.prepare(sql).run()
}

function seedUser(id: string): void {
  run(`insert into users (id, created_at) values ('${id}', '2026-01-01')`)
  run(
    `insert into statement_blocks (user_id, id, name, sort_order, effect, below_the_line, accepts_user_categories)
     values ('${id}', 'b1', 'Despesas Pessoais', 5, 'Subtract', 0, 1)`,
  )
  run(
    `insert into categories (user_id, id, block_id, name, is_system, archived)
     values ('${id}', 'c1', 'b1', 'Alimentação', 0, 0)`,
  )
  run(
    `insert into bank_accounts (user_id, id, label, colour, entity, balance)
     values ('${id}', 'pf', 'Conta PF', 'nubank', 'PF', 100000)`,
  )
  run(
    `insert into bank_accounts (user_id, id, label, colour, entity, balance)
     values ('${id}', 'pj', 'Conta PJ', 'banco-do-brasil', 'PJ', 500000)`,
  )
}

beforeEach(() => {
  connection = createInMemoryDatabase().connection
  seedUser('u1')
})

afterEach(() => {
  connection.close()
})

describe('ADR-0009 — the connection enforces what the schema declares', () => {
  it('has foreign_keys ON, which SQLite does not do by default', () => {
    // Measured, not assumed: with the pragma off every ON DELETE RESTRICT in
    // schema.ts is a comment. SQLite ships it OFF and it is per connection.
    expect(connection.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

describe('entries — the CHECK constraints are the discriminated union, in SQL', () => {
  it('accepts a well-formed despesa', () => {
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id)
         values ('u1', 'e1', 'Expense', 152000, '2026-07-20', 'Paid', 'PF', 'c1', 'Current', 'pf')`,
      ),
    ).not.toThrow()
  })

  it('refuses a despesa without a categoria', () => {
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, entity, classification, bank_account_id)
         values ('u1', 'e2', 'Expense', 1000, '2026-07-20', 'Paid', 'PF', 'Current', 'pf')`,
      ),
    ).toThrow(/entries_expense_revenue_shape/)
  })

  it('files_design/03 — refuses a pró-labore carrying a categoria or an entidade', () => {
    // A pró-labore has no entity by definition: the intercompany engine derives
    // the PF/PJ treatment from the kind. A row with one is a row no rule reads.
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, source_account_id, destination_account_id, category_id)
         values ('u1', 'e3', 'ProLabore', 800000, '2026-07-05', 'Paid', 'pj', 'pf', 'c1')`,
      ),
    ).toThrow(/entries_intercompany_shape/)
  })

  it('files_design/03 — refuses an IR with two accounts', () => {
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, direction, entity, bank_account_id, source_account_id)
         values ('u1', 'e4', 'IncomeTax', 30000, '2026-07-05', 'Paid', 'Payment', 'PF', 'pf', 'pj')`,
      ),
    ).toThrow(/entries_income_tax_shape/)
  })

  it('PRD §5 — refuses a date that is not YYYY-MM-DD', () => {
    // The reports slice the month out of this column as text, so a "20/07/2026"
    // here would silently land in month "20/07/2".
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id)
         values ('u1', 'e5', 'Expense', 1000, '20/07/2026', 'Paid', 'PF', 'c1', 'Current', 'pf')`,
      ),
    ).toThrow(/entries_date_format/)
  })

  it('accepts a Rótulo on IR and refuses one on a despesa', () => {
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, direction, entity, bank_account_id, label)
         values ('u1', 'e6', 'IncomeTax', 30000, '2026-04-30', 'Paid', 'Payment', 'PF', 'pf', 'IRPF 2026')`,
      ),
    ).not.toThrow()

    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id, label)
         values ('u1', 'e7', 'Expense', 1000, '2026-04-30', 'Paid', 'PF', 'c1', 'Current', 'pf', 'mercado')`,
      ),
    ).toThrow(/entries_expense_revenue_shape/)
  })
})

describe('ADR-0008 §3 — the user scope is a foreign key, not a convention', () => {
  it("refuses an entry pointing at another user's categoria", () => {
    seedUser('u2')
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id)
         values ('u2', 'x1', 'Expense', 1000, '2026-07-20', 'Paid', 'PF', 'c1', 'Current', 'pf')`,
      ),
    ).not.toThrow() // u2 has its own 'c1' and 'pf' — same ids, different owner.

    connection.prepare(`delete from entries where user_id = 'u2'`).run()
    // Now point at a category id that exists only for u1.
    run(`insert into categories (user_id, id, block_id, name, is_system, archived)
         values ('u1', 'only-u1', 'b1', 'Só do u1', 0, 0)`)
    expect(() =>
      run(
        `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id)
         values ('u2', 'x2', 'Expense', 1000, '2026-07-20', 'Paid', 'PF', 'only-u1', 'Current', 'pf')`,
      ),
    ).toThrow(/FOREIGN KEY/)
  })
})

describe('deleting is RESTRICT everywhere — a Lançamento is a record, not a detail', () => {
  it('refuses to delete a conta bancária that an entry points at', () => {
    run(
      `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id)
       values ('u1', 'e8', 'Expense', 1000, '2026-07-20', 'Paid', 'PF', 'c1', 'Current', 'pf')`,
    )
    expect(() => run(`delete from bank_accounts where user_id = 'u1' and id = 'pf'`)).toThrow(
      /FOREIGN KEY/,
    )
  })
})

describe('the other aggregates guard their own shape', () => {
  function seedLiability(): void {
    run(
      `insert into liabilities (user_id, id, name, creditor, entity, classification, original_amount,
        installment_amount, installment_count, installments_already_paid, monthly_interest_rate, start_date)
       values ('u1', 'l1', 'Financiamento', 'Banco', 'PF', 'NonCurrent', 32000000, 152000, 360, 0, 0.0085, '2026-01-10')`,
    )
  }

  it('files_design/03 — an installment only carries a valor pago when it is Paga', () => {
    seedLiability()
    expect(() =>
      run(
        `insert into installments (user_id, id, liability_id, number, planned_date, planned_amount, status, paid_amount)
         values ('u1', 'i1', 'l1', 1, '2026-01-10', 152000, 'Planned', 154000)`,
      ),
    ).toThrow(/installments_paid_amount_shape/)
  })

  it('refuses a liability whose "parcelas já pagas" exceeds its "número de parcelas"', () => {
    expect(() =>
      run(
        `insert into liabilities (user_id, id, name, creditor, entity, classification, original_amount,
          installment_amount, installment_count, installments_already_paid, monthly_interest_rate, start_date)
         values ('u1', 'l2', 'Empréstimo', 'Banco', 'PF', 'Current', 100000, 10000, 10, 11, 0.01, '2026-01-10')`,
      ),
    ).toThrow(/liabilities_already_paid_in_range/)
  })

  it('files_design/02 — an allocation item cannot mix two destinations', () => {
    run(
      `insert into profit_allocations (user_id, month, net_profit) values ('u1', '2026-07', 500000)`,
    )
    run(`insert into investments (user_id, id, name, entity, accumulated_value)
         values ('u1', 'inv1', 'Tesouro', 'PF', 100000)`)
    expect(() =>
      run(
        `insert into allocation_items (user_id, id, month, bucket, position, destination_kind,
          destination_investment_id, destination_bank_account_id, amount)
         values ('u1', 'ai1', '2026-07', 'InvestmentContribution', 0, 'Investment', 'inv1', 'pf', 100000)`,
      ),
    ).toThrow(/allocation_items_destination_shape/)
  })

  it('files_design/03 — an item with no destination is allowed: it becomes a Pendência', () => {
    run(
      `insert into profit_allocations (user_id, month, net_profit) values ('u1', '2026-08', 500000)`,
    )
    expect(() =>
      run(
        `insert into allocation_items (user_id, id, month, bucket, position, amount)
         values ('u1', 'ai2', '2026-08', 'CashReserve', 0, 100000)`,
      ),
    ).not.toThrow()
  })

  it('a trace event has exactly one origin', () => {
    seedLiability()
    expect(() =>
      run(
        `insert into trace_events (user_id, id, date, kind, origin_kind, description)
         values ('u1', 't1', '2026-07-20', 'Registration', 'Liability', 'Cadastro')`,
      ),
    ).toThrow(/trace_events_origin_shape/)
  })

  it('a profit allocation month is YYYY-MM', () => {
    expect(() =>
      run(`insert into profit_allocations (user_id, month, net_profit) values ('u1', '2026-7', 1)`),
    ).toThrow(/profit_allocations_month_format/)
  })

  it('refuses a liability with zero or negative "número de parcelas"', () => {
    expect(() =>
      run(
        `insert into liabilities (user_id, id, name, creditor, entity, classification, original_amount,
          installment_amount, installment_count, installments_already_paid, monthly_interest_rate, start_date)
         values ('u1', 'l3', 'Financiamento', 'Banco', 'PF', 'NonCurrent', 100000, 10000, 0, 0, 0.01, '2026-01-10')`,
      ),
    ).toThrow(/liabilities_count_positive/)
  })

  it('refuses a liability with a negative monthly interest rate', () => {
    expect(() =>
      run(
        `insert into liabilities (user_id, id, name, creditor, entity, classification, original_amount,
          installment_amount, installment_count, installments_already_paid, monthly_interest_rate, start_date)
         values ('u1', 'l4', 'Financiamento', 'Banco', 'PF', 'NonCurrent', 100000, 10000, 10, 0, -0.01, '2026-01-10')`,
      ),
    ).toThrow(/liabilities_rate_non_negative/)
  })

  it('files_design/03 — refuses a reajuste de juros with a negative rate', () => {
    seedLiability()
    expect(() =>
      run(
        `insert into rate_adjustments (user_id, id, liability_id, new_rate, effective_from)
         values ('u1', 'ra1', 'l1', -0.005, '2026-06-01')`,
      ),
    ).toThrow(/rate_adjustments_rate_non_negative/)
  })

  function seedRecurrence(id: string): void {
    run(
      `insert into recurrences (user_id, id, amount_kind, start_date, template_kind,
        template_entity, template_category_id, template_classification, template_bank_account_id)
       values ('u1', '${id}', 'Fixed', '2026-01-10', 'Expense', 'PF', 'c1', 'Current', 'pf')`,
    )
  }

  it('files_design/03 — refuses a recurring Expense template carrying source/destination accounts', () => {
    expect(() =>
      run(
        `insert into recurrences (user_id, id, amount_kind, start_date, template_kind,
          template_entity, template_category_id, template_classification, template_bank_account_id,
          template_source_account_id, template_destination_account_id)
         values ('u1', 'r1', 'Fixed', '2026-01-10', 'Expense', 'PF', 'c1', 'Current', 'pf', 'pj', 'pf')`,
      ),
    ).toThrow(/recurrences_template_categorized_shape/)
  })

  it('files_design/03 — refuses a recurring ProLabore template missing the two accounts', () => {
    expect(() =>
      run(
        `insert into recurrences (user_id, id, amount_kind, start_date, template_kind, template_source_account_id)
         values ('u1', 'r2', 'Fixed', '2026-01-10', 'ProLabore', 'pj')`,
      ),
    ).toThrow(/recurrences_template_intercompany_shape/)
  })

  it('files_design/03 — refuses a recurring IncomeTax template with a categoria', () => {
    expect(() =>
      run(
        `insert into recurrences (user_id, id, amount_kind, start_date, template_kind,
          template_direction, template_entity, template_bank_account_id, template_category_id)
         values ('u1', 'r3', 'Fixed', '2026-01-10', 'IncomeTax', 'Payment', 'PF', 'pf', 'c1')`,
      ),
    ).toThrow(/recurrences_template_income_tax_shape/)
  })

  it('PRD §5 — refuses an occurrence month that is not YYYY-MM', () => {
    seedRecurrence('r4')
    expect(() =>
      run(
        `insert into occurrences (user_id, id, recurrence_id, month, planned_date, planned_amount, status)
         values ('u1', 'o1', 'r4', '2026-1', '2026-01-10', 1000, 'Planned')`,
      ),
    ).toThrow(/occurrences_month_format/)
  })

  it('files_design/01 §6 — refuses a Previsto occurrence carrying an entry_id (only Paga produced one)', () => {
    seedRecurrence('r5')
    run(
      `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id)
       values ('u1', 'e9', 'Expense', 1000, '2026-01-10', 'Paid', 'PF', 'c1', 'Current', 'pf')`,
    )
    expect(() =>
      run(
        `insert into occurrences (user_id, id, recurrence_id, month, planned_date, planned_amount, status, entry_id)
         values ('u1', 'o2', 'r5', '2026-01', '2026-01-10', 1000, 'Planned', 'e9')`,
      ),
    ).toThrow(/occurrences_paid_has_entry/)
  })

  it('refuses an allocation item with a negative amount', () => {
    run(
      `insert into profit_allocations (user_id, month, net_profit) values ('u1', '2026-09', 500000)`,
    )
    expect(() =>
      run(
        `insert into allocation_items (user_id, id, month, bucket, position, amount)
         values ('u1', 'ai3', '2026-09', 'CashReserve', 0, -1)`,
      ),
    ).toThrow(/allocation_items_amount_non_negative/)
  })

  it('PRD §5 — a divergência de pagamento a menor must be a positive shortfall (zero is not a divergence)', () => {
    run(
      `insert into entries (user_id, id, kind, amount, date, status, entity, category_id, classification, bank_account_id)
       values ('u1', 'e10', 'Expense', 1000, '2026-07-20', 'Paid', 'PF', 'c1', 'Current', 'pf')`,
    )
    expect(() =>
      run(
        `insert into payment_discrepancies (user_id, id, origin_kind, origin_entry_id, shortfall, origin_date, status)
         values ('u1', 'pd1', 'Entry', 'e10', 0, '2026-07-20', 'Open')`,
      ),
    ).toThrow(/payment_discrepancies_shortfall_positive/)
  })

  it('Consumo Livre — refuses a negative verba mensal', () => {
    expect(() =>
      run(
        `insert into discretionary_spending_config (user_id, monthly_amount, source_account_id, entity)
         values ('u1', -100, 'pf', 'PF')`,
      ),
    ).toThrow(/discretionary_config_amount_non_negative/)
  })
})

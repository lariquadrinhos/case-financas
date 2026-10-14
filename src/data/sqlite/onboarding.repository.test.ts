/**
 * Progresso do Onboarding — testes do adaptador SQLite.
 *
 * Sob medida: a porta é um singleton por pessoa (sem id, sem lista, sem
 * remoção), forma que `describeCrudContract` não cobre — a mesma exceção já
 * documentada em `discretionary-spending.repository.test.ts`.
 */

import { readFileSync } from 'node:fs'

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { UserId } from '@/data/contracts/common'
import { createOnboardingProgressRepository } from './onboarding.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId
const USER_B = 'user-b' as UserId

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

describe('createOnboardingProgressRepository', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database

  beforeEach(() => {
    ;({ db, connection } = createInMemoryDatabase())
    seedUser(connection, USER_A)
    seedUser(connection, USER_B)
  })

  afterEach(() => {
    connection.close()
  })

  it('sem nenhuma escrita responde null — nunca entrou no fluxo', async () => {
    const { reader } = createOnboardingProgressRepository(db)
    await expect(reader.find(USER_A)).resolves.toBeNull()
  })

  it('guarda e devolve o passo em que a pessoa parou (Figma 29:36)', async () => {
    const { reader, writer } = createOnboardingProgressRepository(db)
    await writer.save(USER_A, { status: 'InProgress', lastStep: 3 })
    await expect(reader.find(USER_A)).resolves.toEqual({ status: 'InProgress', lastStep: 3 })
  })

  it('"Fazer depois" (Figma 116:11) é gravado sem passo nenhum', async () => {
    const { reader, writer } = createOnboardingProgressRepository(db)
    await writer.save(USER_A, { status: 'Dismissed', lastStep: null })
    await expect(reader.find(USER_A)).resolves.toEqual({ status: 'Dismissed', lastStep: null })
  })

  it('salvar de novo substitui o progresso, não acumula linha', async () => {
    const { reader, writer } = createOnboardingProgressRepository(db)
    await writer.save(USER_A, { status: 'InProgress', lastStep: 2 })
    await writer.save(USER_A, { status: 'InProgress', lastStep: 4 })
    await writer.save(USER_A, { status: 'Completed', lastStep: 5 })

    await expect(reader.find(USER_A)).resolves.toEqual({ status: 'Completed', lastStep: 5 })
    expect(connection.prepare('select count(*) as total from onboarding_progress').get()).toEqual({
      total: 1,
    })
  })

  it('ADR-0008 §3 — o progresso de uma pessoa não vaza para outra', async () => {
    const { reader, writer } = createOnboardingProgressRepository(db)
    await writer.save(USER_A, { status: 'Completed', lastStep: 5 })
    await expect(reader.find(USER_B)).resolves.toBeNull()
  })

  it('o CHECK do schema recusa um passo fora de 1..5', () => {
    expect(() =>
      connection
        .prepare('insert into onboarding_progress (user_id, status, last_step) values (?, ?, ?)')
        .run(USER_A, 'InProgress', 6),
    ).toThrow()
  })
})

/**
 * O backfill de `drizzle/0003_awesome_warbird.sql`.
 *
 * A regra ANTIGA de `src/app/page.tsx` mandava pra Home quem tivesse pelo
 * menos uma linha em bank_accounts, tangible_assets, investments ou
 * liabilities, e nunca gravou evento nenhum. Um banco já em uso, portanto,
 * atravessa esta migração sem uma linha de progresso — e a abertura do app
 * mandaria a pessoa de volta pro Onboarding 0, o oposto do que
 * files_design/01 §1 promete a quem já configurou.
 *
 * O teste executa o SQL LIDO DO ARQUIVO da migração, não uma cópia dele: uma
 * cópia continuaria passando depois de alguém editar o arquivo.
 */
function backfillStatement(): string {
  const migration = readFileSync('drizzle/0003_awesome_warbird.sql', 'utf8')
  const [, backfill] = migration.split('--> statement-breakpoint')
  if (backfill === undefined) throw new Error('migração 0003 sem o backfill')
  return backfill
}

describe('drizzle/0003 — backfill do progresso', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database

  beforeEach(() => {
    ;({ db, connection } = createInMemoryDatabase())
    // A migração já rodou sobre um banco vazio (nenhum `users`), então o
    // backfill não teve o que inserir: aqui reconstruímos o banco "já em uso"
    // e rodamos só a instrução de dados.
    seedUser(connection, USER_A)
    seedUser(connection, USER_B)
  })

  afterEach(() => {
    connection.close()
  })

  it('quem já tem patrimônio cadastrado passa a contar como concluído', async () => {
    connection
      .prepare(
        `insert into bank_accounts (user_id, id, label, colour, entity, balance)
         values (?, 'conta', 'Nubank', 'nubank', 'PF', 0)`,
      )
      .run(USER_A)

    connection.exec(backfillStatement())

    const { reader } = createOnboardingProgressRepository(db)
    await expect(reader.find(USER_A)).resolves.toEqual({ status: 'Completed', lastStep: 5 })
    // Quem não tinha nada continua sem progresso: a regra antiga já mandava
    // essa pessoa pro Onboarding, e é onde ela continua.
    await expect(reader.find(USER_B)).resolves.toBeNull()
  })
})

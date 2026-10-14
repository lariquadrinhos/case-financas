/**
 * Passivos — the SQLite adapter for the three ports of
 * `src/data/contracts/liabilities.ts`: `Liability`, `Installment` and
 * `RateAdjustment`.
 *
 * Kept in one file, not three, because the three tables are one aggregate in
 * practice — a Passivo without its schedule is half a screen — even though the
 * ports stay segregated (SOLID/ISP), exactly as the port file's own header
 * comment explains.
 */

import { randomUUID } from 'node:crypto'

import { and, eq, sql } from 'drizzle-orm'

import { isForeignKeyViolation } from './constraint-errors'
import { cents } from '@/domain/core'
import type { Installment, Liability, RateAdjustment } from '@/domain/assets'
import {
  asId,
  type Entity,
  type InstallmentId,
  type IsoDate,
  type LiabilityId,
} from '@/domain/core'
import type {
  InstallmentReader,
  InstallmentWriter,
  LiabilityReader,
  LiabilityWriter,
  NewLiability,
  RateAdjustmentReader,
  RateAdjustmentWriter,
} from '@/data/contracts/liabilities'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { installments, liabilities, rateAdjustments, traceEvents } from './schema'

type LiabilityRow = typeof liabilities.$inferSelect
type InstallmentRow = typeof installments.$inferSelect
type RateAdjustmentRow = typeof rateAdjustments.$inferSelect

function toLiability(row: LiabilityRow): Liability {
  return {
    id: asId<LiabilityId>(row.id),
    name: row.name,
    creditor: row.creditor,
    entity: row.entity,
    classification: row.classification,
    originalAmount: cents(row.originalAmount),
    installmentAmount: cents(row.installmentAmount),
    installmentCount: row.installmentCount,
    installmentsAlreadyPaid: row.installmentsAlreadyPaid,
    monthlyInterestRate: row.monthlyInterestRate,
    startDate: row.startDate as IsoDate,
  }
}

function toInstallment(row: InstallmentRow): Installment {
  return {
    id: asId<InstallmentId>(row.id),
    liabilityId: asId<LiabilityId>(row.liabilityId),
    number: row.number,
    plannedDate: row.plannedDate as IsoDate,
    plannedAmount: cents(row.plannedAmount),
    status: row.status,
    paidAmount: row.paidAmount === null ? null : cents(row.paidAmount),
    paidDate: row.paidDate === null ? null : (row.paidDate as IsoDate),
    discarded: row.discarded,
  }
}

function toRateAdjustment(row: RateAdjustmentRow): RateAdjustment {
  return {
    liabilityId: asId<LiabilityId>(row.liabilityId),
    newRate: row.newRate,
    effectiveFrom: row.effectiveFrom as IsoDate,
  }
}

/* -------------------------------------------------------------------------
 * Liability
 * ---------------------------------------------------------------------- */

export function createLiabilityRepository(db: BigornaDatabase): {
  reader: LiabilityReader
  writer: LiabilityWriter
} {
  const reader: LiabilityReader = {
    async findById(userId: UserId, id: LiabilityId) {
      const row = db
        .select()
        .from(liabilities)
        .where(and(eq(liabilities.userId, userId), eq(liabilities.id, id)))
        .get()
      return row ? toLiability(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db.select().from(liabilities).where(eq(liabilities.userId, userId))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toLiability)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(liabilities)
        .where(eq(liabilities.userId, userId))
        .get()
      return row?.total ?? 0
    },

    async listByEntity(userId: UserId, entity: Entity) {
      const rows = db
        .select()
        .from(liabilities)
        .where(and(eq(liabilities.userId, userId), eq(liabilities.entity, entity)))
        .all()
      return rows.map(toLiability)
    },
  }

  const writer: LiabilityWriter = {
    async create(userId: UserId, value: NewLiability) {
      const id = randomUUID()
      db.insert(liabilities)
        .values({ userId, id, ...value })
        .run()
      return { id: asId<LiabilityId>(id), ...value }
    },

    async replace(userId: UserId, value: Liability) {
      const result = db
        .update(liabilities)
        .set({
          name: value.name,
          creditor: value.creditor,
          entity: value.entity,
          classification: value.classification,
          originalAmount: value.originalAmount,
          installmentAmount: value.installmentAmount,
          installmentCount: value.installmentCount,
          installmentsAlreadyPaid: value.installmentsAlreadyPaid,
          monthlyInterestRate: value.monthlyInterestRate,
          startDate: value.startDate,
        })
        .where(and(eq(liabilities.userId, userId), eq(liabilities.id, value.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('liabilities.not_found')
      }
      return value
    },

    /**
     * Apaga o Passivo com o que é DELE: cronograma, reajustes e eventos.
     *
     * Antes disto o "Descartar" da tela de Passivos NUNCA funcionava, e não por
     * um caso de borda: `POST /liabilities` gera o cronograma no cadastro
     * (`buildInstallmentSchedule`) e `installments` tem RESTRICT contra
     * `liabilities` — então todo passivo nasce com filhos que o bloqueiam.
     * Medido contra a base sintética: `DELETE /api/v1/liabilities/{id}`
     * devolvia 409 `liabilities.in_use` em 100% dos casos.
     *
     * As três tabelas apagadas aqui são partes da história do próprio Passivo,
     * não registros independentes: o cronograma é derivado dele, o reajuste só
     * existe para ele, e o Evento de rastreabilidade que sobrasse apontaria
     * para um passivo que não existe mais. O RESTRICT continua valendo para
     * quem aponta de FORA — é essa referência que o `in_use` protege, e o
     * catch abaixo segue no lugar para ela.
     *
     * Mesmo padrão do `remove` de `discretionary-spending.repository.ts`:
     * apagar a linha lateral primeiro, dentro de uma transação.
     */
    async remove(userId: UserId, id: LiabilityId) {
      try {
        db.transaction((tx) => {
          tx.delete(rateAdjustments)
            .where(and(eq(rateAdjustments.userId, userId), eq(rateAdjustments.liabilityId, id)))
            .run()
          tx.delete(installments)
            .where(and(eq(installments.userId, userId), eq(installments.liabilityId, id)))
            .run()
          tx.delete(traceEvents)
            .where(and(eq(traceEvents.userId, userId), eq(traceEvents.originLiabilityId, id)))
            .run()
          tx.delete(liabilities)
            .where(and(eq(liabilities.userId, userId), eq(liabilities.id, id)))
            .run()
        })
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new Error('liabilities.in_use')
        }
        throw error
      }
    },
  }

  return { reader, writer }
}

/* -------------------------------------------------------------------------
 * Installment
 * ---------------------------------------------------------------------- */

export function createInstallmentRepository(db: BigornaDatabase): {
  reader: InstallmentReader
  writer: InstallmentWriter
} {
  const reader: InstallmentReader = {
    async findById(userId: UserId, id: InstallmentId) {
      const row = db
        .select()
        .from(installments)
        .where(and(eq(installments.userId, userId), eq(installments.id, id)))
        .get()
      return row ? toInstallment(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db.select().from(installments).where(eq(installments.userId, userId))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toInstallment)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(installments)
        .where(eq(installments.userId, userId))
        .get()
      return row?.total ?? 0
    },

    async listByLiability(userId: UserId, liabilityId: LiabilityId) {
      const rows = db
        .select()
        .from(installments)
        .where(and(eq(installments.userId, userId), eq(installments.liabilityId, liabilityId)))
        .orderBy(installments.number)
        .all()
      return rows.map(toInstallment)
    },
  }

  const writer: InstallmentWriter = {
    // The whole schedule of one Passivo is replaced atomically: a failure
    // midway must not leave half the old schedule mixed with half the new one
    // (src/data/contracts/liabilities.ts — "half a schedule is a wrong
    // Balanço, not a missing one").
    async replaceSchedule(
      userId: UserId,
      liabilityId: LiabilityId,
      schedule: readonly Installment[],
    ) {
      db.transaction((tx) => {
        tx.delete(installments)
          .where(and(eq(installments.userId, userId), eq(installments.liabilityId, liabilityId)))
          .run()
        for (const installment of schedule) {
          tx.insert(installments)
            .values({
              userId,
              id: installment.id,
              liabilityId: installment.liabilityId,
              number: installment.number,
              plannedDate: installment.plannedDate,
              plannedAmount: installment.plannedAmount,
              status: installment.status,
              paidAmount: installment.paidAmount,
              discarded: installment.discarded,
            })
            .run()
        }
      })
      return schedule
    },

    async replace(userId: UserId, value: Installment) {
      const result = db
        .update(installments)
        .set({
          number: value.number,
          plannedDate: value.plannedDate,
          plannedAmount: value.plannedAmount,
          status: value.status,
          paidAmount: value.paidAmount,
          discarded: value.discarded,
        })
        .where(and(eq(installments.userId, userId), eq(installments.id, value.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('installments.not_found')
      }
      return value
    },
  }

  return { reader, writer }
}

/* -------------------------------------------------------------------------
 * RateAdjustment
 * ---------------------------------------------------------------------- */

export function createRateAdjustmentRepository(db: BigornaDatabase): {
  reader: RateAdjustmentReader
  writer: RateAdjustmentWriter
} {
  const reader: RateAdjustmentReader = {
    async listByLiability(userId: UserId, liabilityId: LiabilityId) {
      const rows = db
        .select()
        .from(rateAdjustments)
        .where(
          and(eq(rateAdjustments.userId, userId), eq(rateAdjustments.liabilityId, liabilityId)),
        )
        .orderBy(rateAdjustments.effectiveFrom)
        .all()
      return rows.map(toRateAdjustment)
    },
  }

  const writer: RateAdjustmentWriter = {
    // Append only: a reajuste is a fact that happened on a date, never edited
    // (src/data/contracts/liabilities.ts).
    async append(userId: UserId, adjustment: RateAdjustment) {
      db.insert(rateAdjustments)
        .values({
          userId,
          id: randomUUID(),
          liabilityId: adjustment.liabilityId,
          newRate: adjustment.newRate,
          effectiveFrom: adjustment.effectiveFrom,
        })
        .run()
      return adjustment
    },
  }

  return { reader, writer }
}

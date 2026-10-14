/**
 * Direcionamentos da sobra do mês — P14 (produto, 2026-09-08).
 *
 * Guarda o direcionamento, não a Pendência: a Pendência da Home é
 * `sobra(mês) − soma daqui` (`pendingLeftover`), derivada como todo relatório
 * (ADR-0001 §1). Não há `replace` nem `remove` — um direcionamento é fato
 * consumado, e corrigir é direcionar de novo.
 */

import { randomUUID } from 'node:crypto'

import { and, asc, eq } from 'drizzle-orm'

import { asId, cents, type LeftoverDirectionId, type Month } from '@/domain/core'
import type { BankAccountId, InvestmentId, LiabilityId } from '@/domain/core'
import type { LeftoverDirection, LeftoverDestination } from '@/domain/discretionary-spending'
import type { UserId } from '@/data/contracts/common'
import type {
  LeftoverDirectionReader,
  LeftoverDirectionWriter,
} from '@/data/contracts/pending-items'

import type { BigornaDatabase } from './client'
import { leftoverDirections } from './schema'

type Row = typeof leftoverDirections.$inferSelect

/**
 * A união marcada volta das quatro colunas. `Discretionary` não tem chave — é a
 * sobra voltando para a verba, e não aponta para agregado nenhum.
 */
function toDestination(row: Row): LeftoverDestination {
  switch (row.destinationKind) {
    case 'BankAccount':
      return {
        kind: 'BankAccount',
        bankAccountId: asId<BankAccountId>(row.destinationBankAccountId!),
      }
    case 'Investment':
      return { kind: 'Investment', investmentId: asId<InvestmentId>(row.destinationInvestmentId!) }
    case 'Liability':
      return { kind: 'Liability', liabilityId: asId<LiabilityId>(row.destinationLiabilityId!) }
    case 'Discretionary':
      return { kind: 'Discretionary' }
  }
}

function toDirection(row: Row): LeftoverDirection {
  return {
    id: asId<LeftoverDirectionId>(row.id),
    month: row.month as Month,
    amount: cents(row.amount),
    destination: toDestination(row),
  }
}

export function createLeftoverDirectionRepository(db: BigornaDatabase): {
  reader: LeftoverDirectionReader
  writer: LeftoverDirectionWriter
} {
  const reader: LeftoverDirectionReader = {
    async list(userId: UserId) {
      return db
        .select()
        .from(leftoverDirections)
        .where(eq(leftoverDirections.userId, userId))
        .orderBy(asc(leftoverDirections.month))
        .all()
        .map(toDirection)
    },

    async listByMonth(userId: UserId, month: Month) {
      return db
        .select()
        .from(leftoverDirections)
        .where(and(eq(leftoverDirections.userId, userId), eq(leftoverDirections.month, month)))
        .all()
        .map(toDirection)
    },
  }

  const writer: LeftoverDirectionWriter = {
    async create(userId: UserId, value) {
      const row = {
        userId,
        id: randomUUID(),
        month: value.month,
        amount: value.amount,
        destinationKind: value.destination.kind,
        destinationBankAccountId:
          value.destination.kind === 'BankAccount' ? value.destination.bankAccountId : null,
        destinationInvestmentId:
          value.destination.kind === 'Investment' ? value.destination.investmentId : null,
        destinationLiabilityId:
          value.destination.kind === 'Liability' ? value.destination.liabilityId : null,
      }
      db.insert(leftoverDirections).values(row).run()
      return toDirection(row as Row)
    },
  }

  return { reader, writer }
}

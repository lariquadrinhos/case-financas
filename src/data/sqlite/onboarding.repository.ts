/**
 * Progresso do Onboarding — o adaptador SQLite de
 * `src/data/contracts/onboarding.ts`.
 *
 * Uma linha por pessoa (`onboarding_progress`, chave primária `user_id`
 * sozinho), então toda escrita é upsert: "Salvar e continuar depois" (Figma
 * 29:36) é clicado quantas vezes a pessoa quiser, e cada clique substitui o
 * passo anterior em vez de acumular linha.
 */

import { eq } from 'drizzle-orm'

import type { OnboardingProgress, OnboardingStep } from '@/domain/onboarding'
import type {
  OnboardingProgressReader,
  OnboardingProgressWriter,
} from '@/data/contracts/onboarding'
import type { UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { onboardingProgress } from './schema'

type ProgressRow = typeof onboardingProgress.$inferSelect

function toProgress(row: ProgressRow): OnboardingProgress {
  return {
    status: row.status,
    // O CHECK `onboarding_last_step_in_range` (schema.ts) já garante 1..5 ou
    // NULL, então a coluna só pode conter um passo válido.
    lastStep: row.lastStep === null ? null : (row.lastStep as OnboardingStep),
  }
}

export function createOnboardingProgressRepository(db: BigornaDatabase): {
  reader: OnboardingProgressReader
  writer: OnboardingProgressWriter
} {
  const reader: OnboardingProgressReader = {
    async find(userId: UserId) {
      const row = db
        .select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId))
        .get()
      return row ? toProgress(row) : null
    },
  }

  const writer: OnboardingProgressWriter = {
    async save(userId: UserId, progress: OnboardingProgress) {
      db.insert(onboardingProgress)
        .values({ userId, status: progress.status, lastStep: progress.lastStep })
        .onConflictDoUpdate({
          target: [onboardingProgress.userId],
          set: { status: progress.status, lastStep: progress.lastStep },
        })
        .run()
      return progress
    },
  }

  return { reader, writer }
}

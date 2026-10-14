/**
 * Progresso do Onboarding. Uma linha por pessoa, então não há id, não há lista
 * e não há `remove` — a mesma forma do par singleton de
 * `discretionary-spending.ts`.
 *
 * A porta existe porque files_design/01 §1 exige "retomando de onde parou" e
 * §2 exige que "Fazer depois" pule pra Home *para valer*, e nenhuma das duas
 * frases é derivável dos lançamentos: são eventos de fluxo, desenhados como
 * três botões distintos no Wireframe (116:11, 29:36, 29:235).
 */

import type { OnboardingProgress } from '@/domain/onboarding'
import type { UserId } from './common'

export interface OnboardingProgressReader {
  /** `null` = nunca entrou no fluxo; a abertura do app manda pro Onboarding 0. */
  find(userId: UserId): Promise<OnboardingProgress | null>
}

export interface OnboardingProgressWriter {
  save(userId: UserId, progress: OnboardingProgress): Promise<OnboardingProgress>
}

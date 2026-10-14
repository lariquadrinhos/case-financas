import 'server-only'

import { getRepositories } from '@/data'
import type { OnboardingProgress, OnboardingStep } from '@/domain/onboarding'
import type { UserId } from '@/server/session'

/**
 * Onde o Onboarding retoma — files_design/01 §1: "Sem dados / onboarding
 * incompleto → vai para **Onboarding**, retomando de onde parou" ·
 * "Onboarding completo → vai direto para **Home**" — e §2: "Fazer depois
 * (secundário, pula pra Home)".
 *
 * As rotas são interface e ficam em português (CLAUDE.md §6), na mesma ordem
 * em que o Wireframe desenha os cinco passos: 29:2 Plano de Contas · 29:39
 * Contas Bancárias · 29:86 Bens Materiais · 29:133 Investimentos · 29:180
 * Passivos.
 */
const STEP_ROUTE: Record<OnboardingStep, string> = {
  1: '/onboarding/plano-de-contas',
  2: '/onboarding/contas-bancarias',
  3: '/onboarding/bens-materiais',
  4: '/onboarding/investimentos',
  5: '/onboarding/passivos',
}

/** O Onboarding 0 — "Antes de começar", Figma 116:2, o primeiro do fluxo. */
export const ONBOARDING_INTRO_ROUTE = '/onboarding'
export const HOME_ROUTE = '/inicio'

export function onboardingStepRoute(step: OnboardingStep): string {
  return STEP_ROUTE[step]
}

/**
 * Para onde a abertura do app manda a pessoa, dado o progresso guardado.
 *
 * Pura de propósito: é a única regra desta correção, e um redirecionamento
 * conferido de cabeça é o mesmo erro que o CLAUDE.md §7.1 proíbe em cálculo de
 * DRE. Ver `src/app/page.test.tsx`.
 */
export function onboardingDestination(progress: OnboardingProgress | null): string {
  if (progress === null) return ONBOARDING_INTRO_ROUTE
  switch (progress.status) {
    case 'Completed':
    case 'Dismissed':
      return HOME_ROUTE
    case 'InProgress':
      return progress.lastStep === null
        ? ONBOARDING_INTRO_ROUTE
        : onboardingStepRoute(progress.lastStep)
  }
}

export async function readOnboardingProgress(userId: UserId): Promise<OnboardingProgress | null> {
  const { onboardingProgressReader } = getRepositories()
  return onboardingProgressReader.find(userId)
}

async function save(userId: UserId, progress: OnboardingProgress): Promise<void> {
  const { onboardingProgressWriter } = getRepositories()
  await onboardingProgressWriter.save(userId, progress)
}

/** "Começar agora" (116:13), "Voltar" (29:33), "Avançar" (29:38) e "Salvar e continuar depois" (29:36). */
export async function markOnboardingAtStep(userId: UserId, step: OnboardingStep): Promise<void> {
  await save(userId, { status: 'InProgress', lastStep: step })
}

/** "Fazer depois" — Figma 116:11, só no Onboarding 0, que não tem passo. */
export async function markOnboardingDismissed(userId: UserId): Promise<void> {
  await save(userId, { status: 'Dismissed', lastStep: null })
}

/** "Concluir" — Figma 29:235, só no passo 5 (29:180). */
export async function markOnboardingCompleted(userId: UserId): Promise<void> {
  await save(userId, { status: 'Completed', lastStep: 5 })
}

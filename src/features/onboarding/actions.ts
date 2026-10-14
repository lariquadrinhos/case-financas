'use server'

import { redirect } from 'next/navigation'

import type { OnboardingStep } from '@/domain/onboarding'
import { requireSession } from '@/server/session'
import {
  HOME_ROUTE,
  ONBOARDING_INTRO_ROUTE,
  markOnboardingAtStep,
  markOnboardingCompleted,
  markOnboardingDismissed,
  onboardingStepRoute,
} from './progress'

/**
 * As saídas do Onboarding, uma Server Action por botão desenhado.
 *
 * São Server Actions, e não `<Link>`, porque cada um destes botões é um EVENTO
 * no Wireframe, com rótulo próprio, e não só uma navegação: "Fazer depois"
 * (116:11) desiste do fluxo, "Salvar e continuar depois" (29:36) sai marcando
 * onde parou e "Concluir" (29:235) encerra. Sem gravar o evento, a abertura do
 * app (files_design/01 §1, `src/app/page.tsx`) não tem como "retomar de onde
 * parou" nem como respeitar "pula pra Home" (§2) — foi exatamente esse o
 * defeito medido em `src/app/page.test.tsx`.
 *
 * O destino NUNCA vem do cliente: cada ação recebe só o número do passo e
 * calcula a rota aqui, para que nenhuma string vinda do navegador vire um
 * redirecionamento.
 */

/** "Começar agora" — Figma 116:13, no Onboarding 0 (116:2). */
export async function startOnboarding(): Promise<void> {
  const session = await requireSession()
  await markOnboardingAtStep(session.userId, 1)
  redirect(onboardingStepRoute(1))
}

/** "Fazer depois" — Figma 116:11. files_design/01 §2: "pula pra Home". */
export async function dismissOnboarding(): Promise<void> {
  const session = await requireSession()
  await markOnboardingDismissed(session.userId)
  redirect(HOME_ROUTE)
}

/** "Voltar" — Figma 29:33. No passo 1 volta pro Onboarding 0, ainda dentro do fluxo. */
export async function goBackFromOnboardingStep(step: OnboardingStep): Promise<void> {
  const session = await requireSession()
  if (step === 1) {
    await markOnboardingAtStep(session.userId, 1)
    redirect(ONBOARDING_INTRO_ROUTE)
  }
  const previous = (step - 1) as OnboardingStep
  await markOnboardingAtStep(session.userId, previous)
  redirect(onboardingStepRoute(previous))
}

/** "Avançar" (29:38) nos passos 1..4; "Concluir" (29:235) no passo 5. */
export async function advanceFromOnboardingStep(step: OnboardingStep): Promise<void> {
  const session = await requireSession()
  if (step === 5) {
    await markOnboardingCompleted(session.userId)
    redirect(HOME_ROUTE)
  }
  const next = (step + 1) as OnboardingStep
  await markOnboardingAtStep(session.userId, next)
  redirect(onboardingStepRoute(next))
}

/** "Salvar e continuar depois" — Figma 29:36, presente nos cinco passos, sem exceção. */
export async function leaveOnboardingAtStep(step: OnboardingStep): Promise<void> {
  const session = await requireSession()
  await markOnboardingAtStep(session.userId, step)
  redirect(HOME_ROUTE)
}

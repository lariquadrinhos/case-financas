import { Button } from '@/components/ui/button'
import { RequiredFieldLegend } from '@/components/ui/field'
import type { OnboardingStep } from '@/domain/onboarding'
import {
  advanceFromOnboardingStep,
  goBackFromOnboardingStep,
  leaveOnboardingAtStep,
} from '@/features/onboarding/actions'
import { cn } from '@/lib/cn'
import { OnboardingProgress } from './onboarding-progress'

/**
 * The wizard card shared by the 5 numbered onboarding steps (files_design/02:
 * "Onboarding é um wizard isolado, sem a barra lateral"). Screen 0 ("Antes de
 * começar") is NOT built on this shell — it has no step counter and no
 * Voltar/Avançar footer, just two buttons (see `src/app/onboarding/page.tsx`).
 *
 * Every field on every step can be skipped: "a obrigatoriedade trava no nível
 * do registro individual... não impede pular uma etapa inteira"
 * (files_design/02, "Salvar e continuar depois"). Voltar, Salvar e continuar
 * depois and Avançar/Concluir are therefore plain navigation, never gated on
 * the state of an in-progress "Adicionar" draft — only the "+ Adicionar"
 * action inside a step validates its own row.
 *
 * The three footer buttons are Server Actions rather than `<Link>`, and the
 * shell takes no href: the Wireframe draws each of them as an EVENT with its
 * own label (29:33 "Voltar", 29:36 "Salvar e continuar depois", 29:38
 * "Avançar", 29:235 "Concluir" only on step 5), and the abertura do app
 * depends on those events being recorded to honour "retomando de onde parou"
 * (files_design/01 §1). Deriving both the route and the recorded step from the
 * SAME `step` prop is what keeps the two from drifting — the sequence is fixed
 * (29:2 → 29:39 → 29:86 → 29:133 → 29:180), so there was never anything for a
 * caller to vary.
 */
export function OnboardingStepShell({
  step,
  stepLabel,
  title,
  description,
  children,
  requiredLegend = false,
  wide = false,
}: {
  step: OnboardingStep
  /** "Plano de Contas", "Contas Bancárias"... — files_design/01 §3. */
  stepLabel: string
  title: string
  description: React.ReactNode
  children: React.ReactNode
  /** Steps with a form show the asterisk legend; Plano de Contas has no required field of its own. */
  requiredLegend?: boolean
  /** Passivos only — files_design/02: "mais largo por ter 8 campos". */
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'w-full rounded-card border border-line-default bg-surface-card p-40',
        wide ? 'max-w-[var(--width-onboarding-wide)]' : 'max-w-[var(--width-onboarding)]',
      )}
    >
      <OnboardingProgress step={step} />

      <p className="mt-24 text-style-body-sm text-ink-secondary">
        Passo {step} de 5: {stepLabel}
      </p>
      <h1 className="mt-8 text-style-heading-xl text-ink-primary">{title}</h1>
      <div className="mt-16 flex flex-col gap-8 text-style-body-sm text-ink-secondary">
        {description}
      </div>

      <div className="mt-24 flex flex-col gap-16">{children}</div>

      <div className="mt-40 flex items-center justify-between gap-16">
        <form action={goBackFromOnboardingStep.bind(null, step)}>
          <Button variant="secondary" type="submit">
            Voltar
          </Button>
        </form>
        <div className="flex items-center gap-8">
          <form action={leaveOnboardingAtStep.bind(null, step)}>
            <Button variant="secondary" type="submit">
              Salvar e continuar depois
            </Button>
          </form>
          <form action={advanceFromOnboardingStep.bind(null, step)}>
            {/* Figma 29:235: o terceiro botão vira "Concluir" só no passo 5 (29:180). */}
            <Button variant="primary" type="submit">
              {step === 5 ? 'Concluir' : 'Avançar'}
            </Button>
          </form>
        </div>
      </div>

      {requiredLegend ? <RequiredFieldLegend className="mt-24" /> : null}
    </div>
  )
}

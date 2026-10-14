import { cn } from '@/lib/cn'

/**
 * Progresso — files_design/07 "Progresso": five pills in a row, the current
 * step's pill wider and in `color/bg/inverse`, the rest in `color/border/default`.
 * "Não marca 'concluído' separadamente do 'atual' — o onboarding é um wizard
 * linear com Voltar/Avançar, então a posição já basta."
 *
 * Only for the fixed 5-step onboarding wizard (files_design/07: "só em fluxos
 * lineares de etapas fixas e conhecidas de antemão") — never reused for the
 * Consumo Livre progress bar, which is a live percentage, not a wizard step.
 */
const STEPS = [1, 2, 3, 4, 5] as const

export function OnboardingProgress({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={step}
      aria-label={`Passo ${step} de 5`}
      className="flex w-[var(--width-onboarding-progress)] gap-8"
    >
      {STEPS.map((current) => (
        <span
          key={current}
          aria-hidden="true"
          className={cn(
            'h-[var(--space-4)] rounded-pill',
            current === step ? 'flex-[2] bg-surface-inverse' : 'flex-1 bg-line-default',
          )}
        />
      ))}
    </div>
  )
}

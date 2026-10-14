import { Button } from '@/components/ui/button'
import { dismissOnboarding, startOnboarding } from '@/features/onboarding/actions'

/**
 * Onboarding 0 — Antes de começar. files_design/01 §2, Figma 116:2.
 *
 * Explains the boundary between "configurar situação atual" (what onboarding
 * does) and "lançamentos e recorrências" (what it does not — that is Novo
 * Lançamento), and offers the two documented ways out: "Fazer depois" (116:11,
 * secundário) straight to Home and "Começar agora" (116:13, primário) into the
 * 5-step wizard.
 *
 * Both are Server Actions, not `<Link>`: files_design/01 §2 says "Fazer
 * depois" *pula pra Home*, and honouring that on the NEXT visit means the
 * choice has to be recorded — otherwise the abertura do app sends the person
 * right back here, which is what used to happen (`src/app/page.test.tsx`).
 */
export default function OnboardingIntroPage() {
  return (
    <div className="w-full max-w-[var(--width-onboarding-narrow)] rounded-card border border-line-default bg-surface-card p-40">
      <h1 className="text-style-heading-xl text-ink-primary">
        Antes de começar, vamos configurar seu Plano de Contas e Patrimônio
      </h1>

      <div className="mt-24 flex flex-col gap-16 text-style-body-sm text-ink-secondary">
        <p>Esta etapa registra sua situação atual: contas, bens, investimentos e dívidas.</p>
        <p>
          Dá pra fazer isso depois, mas configurar agora deixa seus relatórios certos desde o
          primeiro dia.
        </p>
        <p>
          Lançamentos e recorrências não fazem parte desta etapa. Registre suas transações como
          salário e gastos do dia a dia em Novo Lançamento.
        </p>
      </div>

      <div className="mt-24 flex items-center gap-8">
        <form action={dismissOnboarding}>
          <Button variant="secondary" type="submit">
            Fazer depois
          </Button>
        </form>
        <form action={startOnboarding}>
          <Button variant="primary" type="submit">
            Começar agora
          </Button>
        </form>
      </div>
    </div>
  )
}

import { requireSession } from '@/server/session'

/**
 * Shell of the onboarding wizard — files_design/02: "Onboarding é um wizard
 * isolado, sem a barra lateral" (a first run has no data yet, so the sidebar
 * would have nothing useful to show). No theme toggle either: that control
 * lives inside the sidebar (files_design/01 §0) and none of the 6 Onboarding
 * screenshots on the Mockup page carry one.
 *
 * `requireSession()` matches `(app)/layout.tsx`: every screen under here reads
 * or writes data scoped to a user, onboarding included.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireSession()

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-canvas px-24 py-40">
      {children}
    </div>
  )
}

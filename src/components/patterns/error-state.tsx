import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'

/**
 * Error — files_design/01 §15 draws Vazio and Carregando for practically every
 * screen but no frame for a failed read (`docs/figma/INDEX.md` has no "Erro —"
 * entry; the sole hit is note `163:2`, unrelated). A design gap is not
 * permission to let a failed fetch render a blank card: the screen still has
 * to say what failed and offer a way to try again.
 *
 * `role="alert"` announces the failure to a screen reader the moment it
 * mounts, the same reasoning `Field`'s error message uses.
 */
export function ErrorState({
  message = 'Não foi possível carregar os dados. Verifique sua conexão e tente de novo.',
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-8 rounded-control border border-line-default bg-surface-subtle px-24 py-24 text-center"
    >
      <p className="text-style-body-md font-medium text-ink-primary">Algo deu errado</p>
      <p className="max-w-[var(--width-empty-message)] text-style-body-sm text-ink-secondary">
        {message}
      </p>
      <Button variant="secondary" className="mt-8" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}

/**
 * A *write* that fails. `DELETE /bank-accounts/{id}` answers 409
 * `bank_accounts.in_use` when an entry still points at the account (and
 * `liabilities.in_use` / `investments.in_use` do the same), so "Descartar" can
 * legitimately refuse — and without this line the row simply stays put with
 * nothing on screen saying why.
 *
 * Unlike `ErrorState`, the SHAPE here is NOT a design gap: the Style guide
 * closes it in the `Campo` component set (`460:20`), variant `field/error`
 * (`460:11`) — the only error presentation in the whole system, since the 12
 * sets under `383:2` carry no toast, banner, alert or snackbar. Measured on
 * `460:11` (240x88, against 240x64 for the three sibling variants): box
 * `460:13` ends at y=64 and message `460:15` sits at y=70, spanning the full
 * 240 of the control — not the 112 of the text inside the box (`460:14`).
 * Hence `w-full` belongs to the component: it used to be a `className="w-full"`
 * retyped by hand in 3 of the 4 onboarding pages and missing from the other 3
 * call sites, so the rendered width changed page to page with no decision
 * behind it. The token pair is the one files_design/07-style-guide.md:296
 * writes down — "adiciona uma linha de mensagem abaixo em
 * `color/text/negative`" — the same pair `Field` already renders (field.tsx).
 *
 * What genuinely has no source is the COPY, and only the copy: no frame in any
 * of the 5 pages writes an error string for a failed write (grep over the 130
 * Wireframe XML and over `docs/figma/INDEX.md` returns only note `163:2`, about
 * Pendencia/Evento), and the Capa states the delivered scope in `1148:4` — "as
 * 26 telas principais ... mais os 24 estados Vazio". So the message prefers the
 * API's own `detail` whenever there is one (a 409 explains itself) and falls
 * back to invented wording that still needs to reach files_design/04.
 *
 * `role="alert"` because it appears after the click, with no focus move.
 */
export function MutationError({ error }: { error: unknown }) {
  if (!error) return null
  const message =
    error instanceof ApiError ? error.message : 'Não foi possível salvar. Tente novamente.'
  return (
    <p role="alert" className="w-full text-style-body-sm text-ink-negative">
      {message}
    </p>
  )
}

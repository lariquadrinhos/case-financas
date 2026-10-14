import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { EmptyStateCopy } from './empty-states'

/**
 * Empty — the "Vazio" state the Figma drew for practically every card and
 * screen (frames 309:2 onwards).
 *
 * Shape from files_design/01 §15: a short title, a one-to-two-line message
 * saying what will appear there, and an action button ONLY when it makes sense
 * to send the person straight to the fix. Evolução Mensal deliberately has no
 * button — it only fills in with time, so offering an action would be a lie.
 *
 * The copy is not a prop by accident: pass an entry from `EMPTY_STATES`, which
 * holds the design team's exact wording, rather than typing a sentence here.
 */
export function Empty({
  copy,
  onAction,
  actionHref,
  className,
}: {
  copy: EmptyStateCopy
  onAction?: () => void
  /** Use instead of `onAction` when the action is a navigation. */
  actionHref?: string
  className?: string
}) {
  const action = 'action' in copy ? copy.action : undefined
  // A caller that skips both `onAction` and `actionHref` (e.g. the "Adicionar"
  // form already sits right above this same list, files_design/01 §10) means
  // the button would have nothing to do when clicked — render the copy without
  // it rather than a focusable control that silently does nothing on click.
  const canAct = actionHref !== undefined || onAction !== undefined

  return (
    <div className={cn('flex flex-col items-center gap-8 px-40 py-40 text-center', className)}>
      <p className="text-style-body-md font-medium text-ink-primary">{copy.title}</p>
      <p className="max-w-[var(--width-empty-message)] text-style-body-sm text-ink-secondary">
        {copy.message}
      </p>
      {action && canAct ? (
        actionHref ? (
          <Button asChild className="mt-8">
            <a href={actionHref}>{action}</a>
          </Button>
        ) : (
          <Button className="mt-8" onClick={onAction}>
            {action}
          </Button>
        )
      ) : null}
    </div>
  )
}

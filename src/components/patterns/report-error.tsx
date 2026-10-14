'use client'

import { Button } from '@/components/ui/button'

/**
 * files_design/08 §6, "Erro de dado": never draw a partial chart or table —
 * show a message in its place. Shared by the four report screens so the
 * wording and the retry action stay identical everywhere it appears.
 */
export function ReportError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-12 px-40 py-40 text-center">
      <p className="text-style-body-md font-medium text-ink-primary">
        Não foi possível carregar este relatório
      </p>
      <p className="max-w-[var(--width-empty-message)] text-style-body-sm text-ink-secondary">
        Tente novamente em instantes.
      </p>
      <Button onClick={onRetry}>Tentar novamente</Button>
    </div>
  )
}

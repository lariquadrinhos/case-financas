import { Button } from '@/components/ui/button'

/**
 * "Editar" / "Descartar" — files_design/02: "Linhas de item (Bens Materiais,
 * Contas, Investimentos, Passivos) usam os mesmos botões 'Editar' e
 * 'Descartar' em qualquer contexto (onboarding ou edição pós-onboarding), no
 * mesmo estilo visual já usado na Revisão de Recorrentes" — one pair of
 * actions, reused everywhere a cadastro is listed, never renamed to "Remover"
 * or "Excluir" per screen.
 *
 * Rendered as `secondary` buttons: the Mockup screenshot of every onboarding
 * item row (Contas Bancárias, Bens Materiais, Passivos) shows both with a
 * visible `border-line-control` outline, not the borderless "Botão Texto" the
 * written style guide names as its own illustrative example — the two
 * disagree, and the actual shipped screen wins for a component this visible.
 */
export function ItemRowActions({
  onEdit,
  onDiscard,
  editLabel = 'Editar',
  discardLabel = 'Descartar',
}: {
  onEdit: () => void
  onDiscard: () => void
  editLabel?: string
  discardLabel?: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-8">
      <Button variant="secondary" onClick={onEdit}>
        {editLabel}
      </Button>
      <Button variant="secondary" onClick={onDiscard}>
        {discardLabel}
      </Button>
    </div>
  )
}

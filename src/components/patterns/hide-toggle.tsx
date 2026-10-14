import { Button } from '@/components/ui/button'
import { EyeIcon, EyeOffIcon } from '@/components/ui/icons'

/**
 * O "olhinho" da simulação do DRE (pedido do dono, 2026-10-01). Botão de ícone
 * 32×32 com `aria-pressed`: o nome diz o que o clique faz agora — "Ocultar do
 * DRE" ou, já oculto, "Mostrar no DRE". Na categoria vem antes do nome; no
 * lançamento, na ponta direita da linha (escolhas do dono, 2026-10-01).
 */
export function HideToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const label = hidden ? 'Mostrar no DRE' : 'Ocultar do DRE'
  return (
    <Button
      variant="text"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={hidden}
      onClick={onToggle}
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </Button>
  )
}

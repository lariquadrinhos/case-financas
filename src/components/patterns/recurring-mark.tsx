import { RepeatIcon } from '@/components/ui/icons'

/**
 * Marca de "Recorrente" ao lado do nome de um lançamento que vem de uma série
 * (pedido do dono, 2026-10-01: "vale alguma sinalização para mostrar aquilo
 * que é recorrente" → "que tal algum ícone?"). Ícone, não Etiqueta: o Badge
 * tem quatro tipos fechados e um quinto exige um par de tokens no Figma antes
 * (files_design/07, "Etiqueta"). O nome acessível e a dica dizem "Recorrente",
 * o texto do filtro do Histórico. Pendente de design (`icon/repeat`).
 */
export function RecurringMark() {
  return (
    <span role="img" aria-label="Recorrente" title="Recorrente" className="inline-flex">
      <RepeatIcon />
    </span>
  )
}

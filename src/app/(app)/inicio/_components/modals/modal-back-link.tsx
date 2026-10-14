import { DialogClose } from '@/components/ui/dialog'
import { ArrowLeftIcon } from '@/components/ui/icons'

/**
 * "← Despesas por Categoria" / "← Onde Está Meu Dinheiro" / "← Entradas e
 * Saídas" — the back-link every "modal sobre Início" opens with. It closes the
 * dialog, returning to the same Home the modal was opened from — there is
 * nowhere else for "←" to go, since these are dialogs over the Home, not a
 * stacked route.
 *
 * A seta é o COMPONENTE `icon/arrow-left`, não o caractere "←". O Wireframe
 * escreve o glifo dentro do próprio texto (`345:252` nó `189:24`, um nó de
 * texto só com "← Onde Está Meu Dinheiro"), mas ali TODO ícone é glifo — o
 * Wireframe é rascunho. A Mockup, camada visual vigente (ADR-0015 §1), separa
 * os dois; medido agora pelo MCP:
 *
 *   <frame id="1022:3025" name="Link" width="168" height="20">
 *     <instance id="1022:3026" name="icon/arrow-left" x="0" width="20" height="20" />
 *     <text id="1022:3028" name="Onde Está Meu Dinheiro" x="24" width="144" />
 *   </frame>
 *
 * Ícone na grade nativa de 20×20 e texto começando em x=24 — 4px de vão, daí
 * `gap-4`. Mesmo defeito já corrigido na barra lateral e no seletor de mês;
 * este era o terceiro componente que ainda usava glifo solto.
 *
 * O terceiro rótulo era "Mapa de Fluxo", o nome antigo do card. O PRD v7
 * renomeou a tela para "Entradas e Saídas", o componente já passava o nome
 * novo, e a Mockup ficou pela metade no renome: os nós `1022:3036` e
 * `1022:3040` dos dois diálogos de detalhe do fluxo (`1005:3051` claro /
 * `1006:3151` escuro) ainda diziam o nome antigo, enquanto o diálogo irmão
 * `1022:3025` já dizia "Onde Está Meu Dinheiro".
 *
 * **Corrigido no arquivo Figma em 2026-09-11**, com a designer presente: os
 * dois nós passaram a dizer "Entradas e Saídas", texto e nome de camada. As
 * duas molduras "Link" são auto-layout com HUG, então a largura refluiu
 * sozinha (112 → 131) e o ícone seguiu em x=0 com o texto em x=24. Conferido
 * nos DOIS temas — o escuro é onde cor fixa passa despercebida
 * (files_design/07, regra 7). Código e desenho voltaram a concordar.
 */
export function ModalBackLink({ label }: { label: string }) {
  return (
    <DialogClose className="flex items-center gap-4 self-start text-style-body-sm text-ink-secondary hover:text-ink-primary">
      <ArrowLeftIcon />
      {label}
    </DialogClose>
  )
}

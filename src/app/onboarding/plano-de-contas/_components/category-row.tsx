'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ItemRowActions } from '@/components/patterns/item-row-actions'
import { Switch } from '@/components/ui/switch'
import { BLOCK_IDS } from '@/domain/chart-of-accounts'
import {
  categories,
  useArchiveCategory,
} from '@/features/plano-de-contas-e-patrimonio/chart-of-accounts'
import type { Category } from '@/features/plano-de-contas-e-patrimonio/types'

/**
 * One category line inside an expanded block — Figma 44:2 "bloco de categoria
 * expandido": name on the left, "Editar"/"Descartar" on the right. The frame
 * carries its own behaviour note (nó 44:88): "Cada categoria tem
 * Editar/Descartar (mesmo padrão do resto do produto)."
 *
 * "Descartar" **arquiva**, não exclui — ver o comentário de `useArchiveCategory`
 * (@/features/plano-de-contas-e-patrimonio/chart-of-accounts) para por que
 * isso NÃO contraria o "não existe ação de excluir categoria" do PRD §4/§7:
 * o que o PRD proíbe é o DELETE, que não existe; arquivar preserva o registro
 * porque Lançamentos antigos ainda apontam pro id da categoria.
 *
 * Não há exceção ao par de ações: "Consumo Livre" (a única categoria
 * `isSystem`) deixou de ser listada nesta tela — decisão de produto de
 * 2026-09-07, ver o comentário do filtro em `plano-de-contas-step.tsx`. Toda
 * categoria que chega aqui é editável e descartável, exatamente como a nota
 * 44:88 do frame manda.
 *
 * "Editar" swaps the row into an inline rename, e o Figma DESENHA esse estado
 * em dois lugares. O comportamento vem do Wireframe 46:8 "Estado — Editar
 * categoria (inline)", cuja nota (nó 46:33) diz «Campo vira texto editável ali
 * mesmo, sem popup. "Salvar" confirma, "Cancelar" reverte sem alterar.» A
 * GEOMETRIA vem do Mockup `Categoria em edição` (1301:5237), desenhado e
 * aprovado em 2026-09-08 — e onde os dois discordam manda o Mockup (ADR-0015,
 * e files_design/02 "Editar categoria: o Mockup fecha a geometria"):
 *
 *   - o campo ocupa a linha inteira sozinho, com o rótulo VISÍVEL
 *     "Nome da categoria *" acima (o Wireframe não tinha rótulo; o Mockup
 *     usa a instância `Campo`, a mesma da linha de criar categoria);
 *   - o marcador de renda passiva é a segunda linha, rótulo à esquerda e
 *     Toggle à direita (`SPACE_BETWEEN` no frame);
 *   - os botões ficam numa TERCEIRA linha alinhada à DIREITA
 *     (`Ações`, HORIZONTAL/MAX), não à esquerda como o Wireframe 46:28
 *     desenhava — o Wireframe empilha tudo na margem esquerda porque não tem
 *     camada visual; no Mockup a ação de confirmar fica onde o olho termina
 *     de ler o formulário, igual ao "+ Criar categoria" logo abaixo;
 *   - a ordem desenhada continua Cancelar e depois Salvar;
 *   - os dois são `secondary`: files_design/07 §"Botão" limita primário a
 *     "uma só por tela ou por formulário", e esta tela já gasta o dela no
 *     "Avançar" do rodapé (onboarding-shell.tsx).
 *
 * O gap entre os dois botões é `gap-8` (--space-8), o mesmo token que
 * ItemRowActions já usa para o par Editar/Descartar.
 */
export function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = React.useState(false)
  const [draftName, setDraftName] = React.useState(category.name)
  const [draftPassive, setDraftPassive] = React.useState(category.isPassiveIncome)
  const patch = categories.usePatch()
  const archive = useArchiveCategory()

  function startEditing() {
    setDraftName(category.name)
    setDraftPassive(category.isPassiveIncome)
    setEditing(true)
  }

  function save() {
    const trimmed = draftName.trim()
    if (trimmed === '') return
    patch.mutate(
      { id: category.id, body: { name: trimmed, isPassiveIncome: draftPassive } },
      { onSuccess: () => setEditing(false) },
    )
  }

  if (editing) {
    return (
      /* O rótulo visível que o Mockup desenha ("Nome da categoria *") é o MESMO
         da linha de criar categoria logo abaixo, então o bloco expandido passa
         a ter duas caixas com nome acessível idêntico. O grupo rotulado
         resolve sem mexer no texto desenhado: o leitor de tela anuncia
         "Editar categoria Alimentação" ao entrar, e a etiqueta visível
         continua igual ao Figma (WCAG 2.5.3 exige que o nome acessível
         CONTENHA o texto visível — trocar por um aria-label diferente
         quebraria isso). */
      <div
        role="group"
        aria-label={`Editar categoria ${category.name}`}
        className="flex flex-col gap-12 border-b border-line-default py-8 last:border-0"
      >
        {/* 1301:5237 › `Campo` — o campo sozinho na linha, com o rótulo
            visível acima. Mesmo par <label>+<Input> da linha de criar
            categoria (block-accordion-row.tsx), pra que os dois formulários
            desta tela leiam igual. */}
        <label className="flex flex-col gap-4">
          <span className="text-style-body-sm text-ink-secondary">Nome da categoria *</span>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            autoFocus
          />
        </label>
        {/* Marcador de renda passiva — decisão de produto de 2026-09-08 (P22).
            O Wireframe 46:8 mostra só o campo de nome; o controle foi
            desenhado depois, com o time de design, e hoje está no Mockup
            `Categoria em edição` (1301:5237): rótulo à esquerda e Toggle à
            direita, dentro do mesmo formulário — o par rótulo+Switch que
            `recurrence-fields.tsx` já usa.

            Só aparece em Receita Bruta: renda passiva é receita por
            definição, e `passiveIncomeCoverage` só soma linhas desse bloco —
            oferecer o controle numa despesa seria um no-op confuso. */}
        {category.blockId === BLOCK_IDS.grossRevenue ? (
          <div className="flex items-center justify-between gap-16">
            <label
              htmlFor={`passive-income-${category.id}`}
              className="text-style-body-md text-ink-primary"
            >
              Conta como renda passiva
            </label>
            <Switch
              id={`passive-income-${category.id}`}
              checked={draftPassive}
              onCheckedChange={setDraftPassive}
            />
          </div>
        ) : null}
        {/* 1301:5237 › `Ações` — última linha, à direita: Cancelar, Salvar. */}
        <div className="flex items-center justify-end gap-8">
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={save}
            disabled={draftName.trim() === '' || patch.isPending}
          >
            Salvar
          </Button>
        </div>
      </div>
    )
  }

  /* 12 de recuo, não 8: o par Editar/Descartar é 44 (--height-button) e a
     linha fecha em 68, a mesma das três listas de item já desenhadas no Mockup
     (Contas Bancárias, Bens Materiais, Revisão de Recorrentes). Ver o
     comentário gêmeo em
     src/features/plano-de-contas-e-patrimonio/screens/plano-de-contas.tsx. */
  return (
    <div className="flex items-center justify-between gap-16 border-b border-line-default py-12 last:border-0">
      <span className="text-style-body-md text-ink-primary">{category.name}</span>
      <ItemRowActions onEdit={startEditing} onDiscard={() => archive.mutate(category.id)} />
    </div>
  )
}

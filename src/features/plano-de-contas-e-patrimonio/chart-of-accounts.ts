'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { ListEnvelope } from '@/api/http'
import { createResourceHooks } from './use-resource'
import type { Category, CategoryPatch, NewCategory, StatementBlock } from './types'

/** The 10 fixed blocks — read-only over HTTP (files_design/01 §3.1). */
export function useStatementBlocks() {
  return useQuery({
    queryKey: ['statement-blocks'],
    queryFn: () => apiGet<ListEnvelope<StatementBlock>>('/statement-blocks'),
  })
}

export const categories = createResourceHooks<Category, NewCategory, CategoryPatch>('categories')

/**
 * "Descartar" numa linha de categoria — **arquiva, nunca exclui**
 * (`POST /categories/{id}/archive`, files_design/01 §3.1).
 *
 * Uma rodada de auditoria removeu este hook lendo o PRD §4/§7 ("não existe
 * ação de EXCLUIR categoria") como se proibisse o botão. Não proíbe: os dois
 * verbos são coisas diferentes neste produto, e as fontes são explícitas.
 * "Descartar" foi mantido como termo único justamente por NÃO soar definitivo
 * (files_design/02 §"'Descartar' mantido como termo único... não trocado por
 * 'Excluir'"); `archiveCategory` (src/domain/chart-of-accounts/rules.ts) só
 * marca `archived: true` e preserva o registro, porque Lançamentos antigos
 * ainda apontam pro id dela; e `categoryQuerySchema.includeArchived` já nasce
 * `'false'`, de modo que a categoria arquivada some das listas — que é
 * literalmente a frase do PRD, "categoria não utilizada apenas deixa de ser
 * usada". O que de fato não existe é `DELETE /categories/{id}`, e continua não
 * existindo. O Figma 44:2 desenha Editar/Descartar em toda categoria, com nota
 * de comportamento no próprio frame (nó 44:88).
 */
export function useArchiveCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost<Category>(`/categories/${id}/archive`),
    onSuccess: () => client.invalidateQueries({ queryKey: categories.key }),
  })
}

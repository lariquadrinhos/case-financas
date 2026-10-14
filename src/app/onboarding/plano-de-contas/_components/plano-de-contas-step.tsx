'use client'

import * as React from 'react'
import { OnboardingStepShell } from '@/components/patterns/onboarding-shell'
import { Loading } from '@/components/patterns/loading'
import { ErrorState } from '@/components/patterns/error-state'
import {
  useStatementBlocks,
  categories,
} from '@/features/plano-de-contas-e-patrimonio/chart-of-accounts'
import { BlockAccordionRow } from './block-accordion-row'

/**
 * Onboarding 1 — Plano de Contas. files_design/01 §3.1, Figma 29:2.
 *
 * The 10 blocks are seeded server-side before this component ever mounts
 * (`src/app/onboarding/plano-de-contas/page.tsx`), so the only states this
 * client component has to render are the ordinary query ones: loading, error,
 * and the accordion itself.
 */
export function PlanoDeContasStep() {
  const blocksQuery = useStatementBlocks()
  const categoriesQuery = categories.useList()
  const [openBlockId, setOpenBlockId] = React.useState<string | null>(null)

  const isLoading = blocksQuery.isLoading || categoriesQuery.isLoading
  const isError = blocksQuery.isError || categoriesQuery.isError

  const blocks = React.useMemo(
    () => [...(blocksQuery.data?.data ?? [])].sort((a, b) => a.order - b.order),
    [blocksQuery.data],
  )
  const allCategories = categoriesQuery.data?.data ?? []

  // Figma 29:2 (collapsed) carries no "* Campo obrigatório" legend — there is
  // no visible required field until a block that accepts categories is open
  // and shows "Nome da categoria *" (Figma 44:2). D&A's expanded content has
  // no field at all, so it does not count either.
  const openBlock = blocks.find((block) => block.id === openBlockId)
  const showRequiredLegend = Boolean(openBlock?.acceptsUserCategories)

  return (
    <OnboardingStepShell
      step={1}
      stepLabel="Plano de Contas"
      title="Revise seu plano de contas"
      requiredLegend={showRequiredLegend}
      description={
        <>
          <p>
            Este é o modelo inicial do seu Plano de Contas. Os blocos abaixo (Receita Bruta,
            Despesas, etc.) são fixos e organizam seus relatórios. Dentro de cada um, você pode
            editar as categorias já sugeridas ou criar as suas. Crie categorias agora e lance os
            valores depois em Novo Lançamento.
          </p>
          <p>
            Cada bloco pode ser expandido, clique no nome do bloco pra ver e editar as categorias
            dentro dele.
          </p>
        </>
      }
    >
      {isLoading ? (
        <Loading label="Carregando plano de contas" lines={6} />
      ) : isError ? (
        <ErrorState
          message="Não foi possível carregar o plano de contas. Verifique sua conexão e tente de novo."
          onRetry={() => {
            void blocksQuery.refetch()
            void categoriesQuery.refetch()
          }}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {blocks.map((block) => (
            <BlockAccordionRow
              key={block.id}
              block={block}
              // "Consumo Livre" (a única categoria `isSystem`) NÃO aparece
              // aqui: decisão de produto de 2026-09-07 — ela deixa de ser
              // uma linha do bloco Despesas Pessoais/Consumo e passa a ser
              // tratada como área de consumo isolada, com widget próprio na
              // Home (files_design/01 §4a). Isso resolve na raiz a
              // contradição que o frame 44:2 expunha: a nota 44:88 diz que
              // "cada categoria tem Editar/Descartar", mas o contrato da API
              // proíbe renomear ou arquivar a categoria de sistema, porque o
              // widget sempre lança nela. Tirando-a da lista, a regra do
              // frame passa a valer sem exceção para tudo que está listado.
              categoryList={allCategories.filter(
                (category) => category.blockId === block.id && !category.isSystem,
              )}
              expanded={openBlockId === block.id}
              onToggle={() => setOpenBlockId((current) => (current === block.id ? null : block.id))}
            />
          ))}
        </div>
      )}
    </OnboardingStepShell>
  )
}

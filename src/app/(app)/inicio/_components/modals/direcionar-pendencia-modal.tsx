'use client'

/**
 * "Direcionar agora" — Pendências (files_design/01 §4: "Se sobrar valor não
 * direcionado, vira uma Pendência na Home, com botão 'Direcionar agora'";
 * files_design/03 "Pendente de Direcionamento": "Ação 'Direcionar agora' abre
 * a mesma escolha de conta que aparecia no modal de venda").
 *
 * Before this modal existed, the button was a bare `<Link href="/bens-materiais">`
 * — measured live: the bem material that generated the Pendência is already
 * gone from that list (a sale removes it, files_design/01 §11), so the page it
 * linked to has no "Vender"/"Editar" able to reopen the allocation choice.
 * `POST /pending-allocations/{id}/allocations` (src/app/api/v1/pending-
 * allocations/[id]/allocations/route.ts) already implements "Direcionar
 * agora" server-side and was never called from any component — this is the
 * one caller.
 *
 * `directPendingAllocation` (src/domain/assets/pending-allocation-rules.ts)
 * requires the allocations to sum to EXACTLY the pending amount — there is no
 * partial state — so "Confirmar" stays disabled until Restante is zero.
 */

import * as React from 'react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RequiredFieldLegend } from '@/components/ui/field'
import { formatMoney, isZero, subtract, type Cents } from '@/domain/core'
import { ApiError } from '@/lib/api-client'
import {
  AllocationEditor,
  type DraftAllocation,
} from '@/features/plano-de-contas-e-patrimonio/screens/allocation-editor'
import { remainingToAllocate } from '@/features/plano-de-contas-e-patrimonio/allocation-rules'
import { useCreateRevenueEntry } from '@/features/plano-de-contas-e-patrimonio/entries'
import { useDirectPendingAllocation } from '../../_lib/mutations'

export interface PendingAllocationSelection {
  readonly id: string
  readonly amount: Cents
  /** "Venda de {nome}", já resolvido pelo card — vazio enquanto o nome carrega. */
  readonly description: string
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível concluir. Tente novamente.'
}

export function DirecionarPendenciaModal({
  selection,
  open,
  onOpenChange,
}: {
  selection: PendingAllocationSelection | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 440 de largura: frame 103:22 (Wireframe), o contêiner do modal em 103:21.
          Desenhado em tamanho real na Mockup em 2026-09-11, sobre o Início:
          `Desktop — Direcionar Valor (Pendência) (claro)` (`1427:6276`, diálogo
          `1427:6514`) e `(escuro)` (`1427:6551`). O frame mostra o estado que
          manda no botão: com Restante > 0 o "Confirmar" fica desabilitado,
          porque `directPendingAllocation` exige soma EXATA. */}
      <DialogContent width="allocation">
        {selection ? (
          // `key` forces a fresh mount (and fresh draft state) per pendência —
          // the same reason `VenderBemMaterialDialog` resets on `asset.id`.
          <DirecionarPendenciaBody
            key={selection.id}
            selection={selection}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DirecionarPendenciaBody({
  selection,
  onOpenChange,
}: {
  selection: PendingAllocationSelection
  onOpenChange: (open: boolean) => void
}) {
  const direct = useDirectPendingAllocation()
  // O lançamento de Receita de um Direcionamento nasce no "Confirmar", não no
  // "Direcionar" (Figma 103:46) — é o que deixa "Editar" (99:2 → 103:13) e
  // "Remover" (103:15) operarem sobre rascunho. Ver topo de allocation-editor.
  const createRevenueEntry = useCreateRevenueEntry()
  const [allocations, setAllocations] = React.useState<readonly DraftAllocation[]>([])
  const [submitError, setSubmitError] = React.useState<string | undefined>(undefined)

  const remaining = remainingToAllocate(selection.amount, allocations)

  async function handleConfirm() {
    if (remaining !== 0) {
      setSubmitError('Os direcionamentos precisam somar exatamente o valor pendente.')
      return
    }
    setSubmitError(undefined)

    // Sequencial de propósito: se um lançamento falhar, os seguintes não são
    // criados e a Pendência não é resolvida — a pessoa corrige e clica de novo.
    for (const allocation of allocations) {
      if (allocation.revenue === null) continue
      try {
        await createRevenueEntry.mutateAsync({
          kind: 'Revenue',
          amount: allocation.amount,
          date: allocation.revenue.date,
          status: allocation.revenue.status,
          entity: allocation.revenue.entity,
          categoryId: allocation.revenue.categoryId,
          classification: 'Current',
          bankAccountId: allocation.revenue.bankAccountId,
          recurrence: null,
        })
      } catch (error) {
        setSubmitError(errorMessage(error))
        return
      }
    }

    direct.mutate(
      {
        id: selection.id,
        allocations: allocations.map((allocation) => ({
          kind: allocation.kind,
          target: allocation.target,
          amount: allocation.amount,
        })),
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => setSubmitError(errorMessage(error)),
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Direcionar valor</DialogTitle>
        <DialogDescription>
          {selection.description} · {formatMoney(selection.amount)} aguardando direcionamento
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-8">
          <p className="text-style-body-md font-medium text-ink-primary">
            Direcionar valor recebido
          </p>
          <AllocationEditor
            allocations={allocations}
            remaining={remaining}
            onAdd={(draft) => setAllocations((prev) => [...prev, draft])}
            onEdit={(draft) =>
              setAllocations((prev) => prev.map((item) => (item.id === draft.id ? draft : item)))
            }
            onRemove={(id) =>
              setAllocations((prev) => prev.filter((allocation) => allocation.id !== id))
            }
          />

          {/* O resumo FECHA o bloco, e em duas frases — as duas coisas vêm do
              frame `Desktop — Vender Bem Material`, que é onde o Figma desenha
              este bloco em tamanho real. Dentro de `991:2220` a ordem é rótulo
              `991:2221` → "Alocação" `991:2222` → "Divisor" com o "+ Adicionar"
              `991:2225` → "Resumo" `991:2229`, com os textos `991:2230` e
              `991:2231`. O total só diz alguma coisa depois de a pessoa ver o
              que já direcionou.

              As duas frases também resolvem largura, medida no navegador em
              2026-09-11 (clone com `white-space: nowrap`, na tipografia real):
              numa linha só o resumo pede 316 vazio, 396 com valores realistas e
              517 no teto de 999 bilhões, contra 392 de espaço útil — não cabia
              nem no estado vazio. Separadas, medem 253 e 134. */}
          <div className="flex flex-col gap-4">
            <p className="text-style-body-sm text-ink-secondary">
              Direcionado: {formatMoney(subtract(selection.amount, remaining))} de{' '}
              {formatMoney(selection.amount)}
            </p>
            <p className="text-style-body-sm text-ink-secondary">
              Restante: {formatMoney(remaining)}
            </p>
          </div>
        </div>

        {!isZero(remaining) ? (
          <p className="rounded-control bg-surface-subtle px-16 py-12 text-style-body-sm text-ink-secondary">
            A Pendência só é resolvida quando os direcionamentos somarem o valor inteiro — nenhum
            valor pode ficar de fora.
          </p>
        ) : null}

        {submitError ? (
          <p role="alert" className="text-style-body-sm text-ink-negative">
            {submitError}
          </p>
        ) : null}

        <RequiredFieldLegend />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          disabled={direct.isPending || createRevenueEntry.isPending || remaining !== 0}
          onClick={() => void handleConfirm()}
        >
          {direct.isPending || createRevenueEntry.isPending ? 'Confirmando…' : 'Confirmar'}
        </Button>
      </DialogFooter>
    </>
  )
}

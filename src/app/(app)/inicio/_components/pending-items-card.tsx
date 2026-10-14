'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardBody, CardHeader, CardTitle, CardCaption } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/patterns/empty'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { formatMoney, formatMonthName, type Cents, type Month } from '@/domain/core'
import { apiGet } from '@/lib/api-client'
import { log } from '@/lib/log'
import { usePendingItems, useRecurrence } from '../_lib/queries'
import type { PendingItem } from '../_lib/queries'
import { usePayDiscrepancy } from '../_lib/mutations'
import type { Category } from '../_lib/queries'
import { DirecionarSobraModal, type SobraSelection } from './modals/direcionar-sobra-modal'
import { CategorizeDialog } from '@/features/open-finance/categorize-dialog'
import {
  ClassifyTransferDialog,
  type TransferToClassify,
} from '@/features/open-finance/classify-transfer-dialog'
import {
  DirecionarPendenciaModal,
  type PendingAllocationSelection,
} from './modals/direcionar-pendencia-modal'

/**
 * Pendências — files_design/01 §4, files_design/08 §9.1. One card per
 * OCCURRENCE, not per type: two discrepancies in different recorrências are
 * two cards. Ordered oldest first (the read model already returns that way,
 * `collectPendingItems`, `src/domain/pending-items`).
 *
 * Nenhum dos quatro tipos desenha DATA: nem o Wireframe (`115:2`, os cartões
 * `115:5`, `115:11`, `115:17`, `151:2`), nem o Mockup (`549:75`), nem os
 * estados Vazio (`309:2`) e Carregando (`309:26`) — o card vizinho Eventos
 * Recentes, na mesma Home, imprime `dd/mm/aaaa` (`150:7`), então a ausência
 * aqui é escolha do desenho. `item.date` é chave de ordenação interna, nunca
 * texto de tela. O gap de 12px da fileira é o dos dois frames (Wireframe
 * 257.5−245.5 = 12; Mockup 263−251 = 12).
 */
export function PendingItemsCard({ categories }: { categories: readonly Category[] | undefined }) {
  const { data, isPending, isError } = usePendingItems()
  // Lifted above the per-item cards so exactly one modal exists regardless of
  // how many Pendências de Direcionamento are on screen at once.
  const [selection, setSelection] = React.useState<PendingAllocationSelection | null>(null)
  const [sobra, setSobra] = React.useState<SobraSelection | null>(null)
  const [categorizar, setCategorizar] = React.useState<Month | null>(null)
  const [classificar, setClassificar] = React.useState<TransferToClassify | null>(null)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pendências</CardTitle>
          <CardCaption>
            Coisas que precisam da sua decisão: valor sem destino, recorrência sem valor definido,
            ou lucro do mês ainda não distribuído.
          </CardCaption>
        </CardHeader>
        <CardBody>
          {isPending || !data ? (
            <Loading bars={SKELETON_BARS.PENDENCIAS} />
          ) : isError ? (
            <p className="text-style-body-sm text-ink-secondary">
              Não foi possível carregar as pendências agora.
            </p>
          ) : data.data.length === 0 ? (
            <Empty copy={EMPTY_STATES.PENDENCIAS} />
          ) : (
            <div className="flex flex-wrap gap-12">
              {data.data.map((item) => (
                <PendingItemCard
                  key={itemKey(item)}
                  item={item}
                  categories={categories}
                  onDirecionar={setSelection}
                  onDirecionarSobra={setSobra}
                  onCategorizar={setCategorizar}
                  onClassificar={setClassificar}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <ClassifyTransferDialog
        transfer={classificar}
        onOpenChange={(open) => {
          if (!open) setClassificar(null)
        }}
      />
      <CategorizeDialog
        month={categorizar}
        onOpenChange={(open) => {
          if (!open) setCategorizar(null)
        }}
      />
      <DirecionarSobraModal
        selection={sobra}
        open={sobra !== null}
        onOpenChange={(open) => {
          if (!open) setSobra(null)
        }}
      />
      <DirecionarPendenciaModal
        selection={selection}
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null)
        }}
      />
    </>
  )
}

function itemKey(item: PendingItem): string {
  switch (item.kind) {
    case 'AssetSaleAllocation':
      return `asset-${item.item.id}`
    case 'UndefinedOccurrence':
      return `occurrence-${item.item.id}`
    case 'UnallocatedProfit':
      return `profit-${item.item.month}`
    case 'PaymentDiscrepancy':
      return `discrepancy-${item.item.id}`
    case 'DiscretionaryLeftover':
      return `leftover-${item.item.month}`
    case 'Uncategorized':
      return `uncategorized-${item.item.month}`
    case 'UnclassifiedTransfer':
      return `transfer-${item.item.transactionId}`
  }
}

function PendingItemCard({
  item,
  categories,
  onDirecionar,
  onDirecionarSobra,
  onCategorizar,
  onClassificar,
}: {
  item: PendingItem
  categories: readonly Category[] | undefined
  onDirecionar: (selection: PendingAllocationSelection) => void
  onDirecionarSobra: (selection: SobraSelection) => void
  onCategorizar: (month: Month) => void
  onClassificar: (transfer: TransferToClassify) => void
}) {
  const pay = usePayDiscrepancy()
  const description = usePendingItemDescription(item, categories)

  return (
    <div className="flex min-w-[var(--width-pending-card-min)] flex-1 flex-col justify-between gap-16 rounded-card border border-line-default bg-surface-card p-16">
      <div className="flex flex-col gap-4">
        <p className="text-style-heading-sm text-ink-primary">{headline(item)}</p>
        <p className="text-style-body-sm text-ink-secondary">{description}</p>
      </div>
      {item.kind === 'PaymentDiscrepancy' ? (
        <Button width="full" disabled={pay.isPending} onClick={() => pay.mutate(item.item.id)}>
          Pagar
        </Button>
      ) : item.kind === 'AssetSaleAllocation' ? (
        <Button
          width="full"
          onClick={() =>
            onDirecionar({ id: item.item.id, amount: item.amount as Cents, description })
          }
        >
          Direcionar agora
        </Button>
      ) : item.kind === 'DiscretionaryLeftover' ? (
        <Button
          width="full"
          onClick={() =>
            onDirecionarSobra({
              month: item.item.month as Month,
              remaining: item.amount as Cents,
            })
          }
        >
          Direcionar agora
        </Button>
      ) : item.kind === 'UnclassifiedTransfer' ? (
        <Button
          width="full"
          onClick={() =>
            onClassificar({
              transactionId: item.item.transactionId,
              from: item.item.from,
              to: item.item.to,
              amount: item.amount,
              description: item.item.description,
            })
          }
        >
          Classificar agora
        </Button>
      ) : item.kind === 'Uncategorized' ? (
        <Button width="full" onClick={() => onCategorizar(item.item.month as Month)}>
          Categorizar agora
        </Button>
      ) : item.kind === 'UndefinedOccurrence' ? (
        <Button asChild width="full">
          <Link href="/revisao-de-recorrentes">Revisar agora</Link>
        </Button>
      ) : (
        <Button asChild width="full">
          <Link href="/dre">Alocar agora</Link>
        </Button>
      )}
    </div>
  )
}

function headline(item: PendingItem): string {
  switch (item.kind) {
    case 'AssetSaleAllocation':
      return `${formatMoney(item.amount as Cents)} aguardando direcionamento`
    case 'UndefinedOccurrence':
      return 'Recorrente pendente este mês'
    case 'UnallocatedProfit':
      // O mês por extenso é o ÚNICO identificador que o desenho dá a este card:
      // Wireframe `115:19` e Mockup `549:93` escrevem os dois "R$ 3.000,00 do
      // lucro de Julho não alocado". Sem ele, duas Pendências de lucro em aberto
      // (Junho e Julho) renderizavam dois cards de texto idêntico — medido no
      // teste "distingue dois meses em aberto na mesma Home" — e os dois botões
      // "Alocar agora" levam ao mesmo /dre, sem dizer qual mês é qual.
      return `${formatMoney(item.amount as Cents)} do lucro de ${formatMonthName(item.item.month as Month)} não alocado`
    case 'PaymentDiscrepancy':
      return `${formatMoney(item.amount as Cents)} pendente`
    case 'DiscretionaryLeftover':
      // Mesma fórmula da venda de bem material — é o mesmo problema, "valor sem
      // destino", e o Mockup desenha os dois cards com esta frase.
      return `${formatMoney(item.amount as Cents)} aguardando direcionamento`
    case 'UnclassifiedTransfer':
      return `${formatMoney(item.amount as Cents)} de ${item.item.from} para ${item.item.to}`
    case 'Uncategorized':
      return item.item.count === 1
        ? '1 lançamento a categorizar'
        : `${item.item.count} lançamentos a categorizar`
  }
}

/**
 * The read model (`pending-items`) carries only ids for the thing each
 * pendência originated from — the descriptive line the Figma shows ("Venda de
 * Civic 2020", "Aluguel de Julho pago a menos") requires one extra read per
 * card, resolved here rather than duplicating a join the API does not offer.
 */
function usePendingItemDescription(
  item: PendingItem,
  categories: readonly Category[] | undefined,
): string {
  const assetName = useTangibleAssetName(
    item.kind === 'AssetSaleAllocation' ? item.item.origin.tangibleAssetId : undefined,
  )
  const entry = useEntry(item.kind === 'PaymentDiscrepancy' ? item.item.origin.entryId : undefined)
  // An Occurrence carries no category of its own — only its Recorrência's
  // template does (`src/api/contracts/recurrences.ts`).
  const recurrence = useRecurrence(
    item.kind === 'UndefinedOccurrence' ? item.item.recurrenceId : undefined,
  )

  switch (item.kind) {
    case 'AssetSaleAllocation':
      return assetName.data ? `Venda de ${assetName.data}` : 'Venda de bem material'
    case 'UndefinedOccurrence': {
      const template = recurrence.data?.template
      if (template && 'categoryId' in template) {
        const category = categories?.find((c) => c.id === template.categoryId)
        return category ? `${category.name}: valor a definir` : 'Valor a definir'
      }
      return 'Valor a definir'
    }
    case 'UnallocatedProfit':
      return 'Destinação do lucro ficou incompleta'
    case 'PaymentDiscrepancy':
      return entry.data ? `${entryLabel(entry.data, categories)} pago a menos` : 'Pago a menos'
    case 'DiscretionaryLeftover':
      // O mês por extenso é o identificador, mesma razão do lucro não alocado:
      // duas sobras em aberto renderizariam cards idênticos sem ele.
      return `Sobra do Consumo Livre de ${formatMonthName(item.item.month as Month)}`
    case 'UnclassifiedTransfer':
      return `Transferência a classificar: ${item.item.description}`
    case 'Uncategorized':
      return `Vindos do banco em ${formatMonthName(item.item.month as Month)}`
  }
}

function entryLabel(
  entry: { kind: string; categoryId?: string; label?: string | null },
  categories: readonly Category[] | undefined,
): string {
  if ('categoryId' in entry && entry.categoryId) {
    const category = categories?.find((c) => c.id === entry.categoryId)
    if (category) return category.name
  }
  if ('label' in entry && entry.label) return entry.label
  return 'Lançamento'
}

function useTangibleAssetName(id: string | undefined) {
  return useQuery({
    queryKey: ['tangible-assets', id],
    queryFn: () => apiGet<{ name: string }>(`/tangible-assets/${id}`),
    enabled: id !== undefined,
    select: (asset) => asset.name,
    // Resolving a display label is best-effort: the button still works if this fails.
    retry: false,
    meta: { onError: () => log.warn('pending_items.asset_name_lookup_failed') },
  })
}

function useEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['entries', id],
    queryFn: () =>
      apiGet<{ kind: string; categoryId?: string; label?: string | null }>(`/entries/${id}`),
    enabled: id !== undefined,
    retry: false,
  })
}

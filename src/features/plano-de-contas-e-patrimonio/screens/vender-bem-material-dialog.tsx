'use client'

/**
 * "Vender Bem Material" — files_design/01 §11, files_design/03 "Vender Bem
 * Material" / "Objeto Direcionamento".
 *
 * What this dialog deliberately does NOT invent: `evaluateAssetSale`'s own
 * header comment (`src/domain/assets/sale.ts`) says the sale endpoint never
 * bumps an Investimento's saldo, amortises um Passivo, nor posts the
 * Direcionamento's money anywhere — "Redirecionamento" as one operation across
 * five screens is Event Storming hotspot H12, explicitly open. This screen
 * therefore does exactly what the CONTRACT supports: it sends
 * `{ amount, date, allocations }` to `POST /tangible-assets/{id}/sale`, which
 * computes ganho/perda and the Pendente de Direcionamento — and, for the one
 * allocation kind that DOES have its own real side effect (Receita opens the
 * existing Receita lançamento, files_design/03), it calls `POST /entries`
 * itself, exactly the one call Novo Lançamento's own "Salvar" button would
 * make.
 *
 * QUANDO essa chamada sai é desenhado, e por isso ela sai de `handleConfirm`:
 * no frame 99:2 (página Wireframe,
 * docs/figma/frames/99-2__desktop-vender-bem-material-modal.xml) cada linha da
 * lista de Direcionamentos (103:8) traz "Editar" (103:13) E "Remover" (103:15),
 * e a única ação de gravação do modal é o rodapé 99:67 "Confirmar Venda" — a
 * lista é RASCUNHO até ali, nos três Tipos. A versão anterior disparava o
 * `POST /entries` já no "Direcionar" (103:46) do sub-formulário e, para
 * conviver com isso, escondia o "Editar" desenhado quando o kind era Receita —
 * e o "Remover" deixava o lançamento órfão no Histórico.
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
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { DateField } from '@/components/patterns/date-field'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { SearchCreateField } from '@/components/patterns/search-create-field'
import { StatusFieldHelp } from '@/components/patterns/field-help'
import { ALLOCATION_KINDS, LABEL_ALLOCATION_KIND, type AllocationKind } from '@/domain/assets'
import { normalizeForSearch } from '@/domain/chart-of-accounts'
import { ZERO, add, cents, formatMoney, isZero, subtract, type Cents } from '@/domain/core'
import { ApiError } from '@/lib/api-client'
import { fitsWithinRemaining, remainingToAllocate } from '../allocation-rules'
import { investments } from '../investments'
import { liabilities } from '../liabilities'
import { InvestmentForm } from '../investment-form'
import { LiabilityForm } from '../liability-form'
import { categories } from '../chart-of-accounts'
import { bankAccounts } from '../bank-accounts'
import { useSellTangibleAsset } from '../tangible-assets'
import { useCreateRevenueEntry } from '../entries'
import { todayIsoDate } from '../today'
import type { TangibleAsset } from '../types'

/** The Receita fields collected in the sub-form, held until "Confirmar Venda"
 * (Figma 99:67) posts them — see the file header. `amount` is not repeated
 * here: it is the Direcionamento's own `amount`, and Editar may change it. */
interface DraftRevenue {
  readonly date: string
  readonly status: 'Planned' | 'Paid'
  readonly entity: 'PF' | 'PJ'
  readonly categoryId: string
  readonly bankAccountId: string
}

interface DraftAllocation {
  readonly id: string
  readonly kind: AllocationKind
  readonly target: string | null
  /** The target's own display name, kept apart from `label` so Editar can
   * re-seed the destino picker without re-parsing `label`. */
  readonly targetLabel: string | null
  readonly amount: Cents
  readonly label: string
  /** Non-null only for kind Receita. */
  readonly revenue: DraftRevenue | null
}

const STATUS_OPTIONS = [
  { value: 'Planned' as const, label: 'Previsto' },
  { value: 'Paid' as const, label: 'Recebido' },
]
const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível concluir. Tente novamente.'
}

export function VenderBemMaterialDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: TangibleAsset
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sell = useSellTangibleAsset()
  // Figma 99:67 "Confirmar Venda" é a única gravação do modal: o lançamento de
  // Receita de um Direcionamento nasce aqui, não no "Direcionar" (103:46).
  const createRevenueEntry = useCreateRevenueEntry()
  const [amount, setAmount] = React.useState<Cents>(ZERO)
  const [date, setDate] = React.useState<string>(todayIsoDate())
  const [allocations, setAllocations] = React.useState<readonly DraftAllocation[]>([])
  const [addingOpen, setAddingOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | undefined>(undefined)
  const [gainAccountId, setGainAccountId] = React.useState<string | undefined>(undefined)

  // Reset every time the dialog opens for a (possibly different) asset —
  // stale state from a previous sale must never leak into the next one.
  React.useEffect(() => {
    if (open) {
      setAmount(ZERO)
      setDate(todayIsoDate())
      setAllocations([])
      setAddingOpen(false)
      setEditingId(null)
      setGainAccountId(undefined)
      setSubmitError(undefined)
    }
  }, [open, asset.id])

  const gainAccounts = bankAccounts.useList()
  const gainOrLoss = subtract(amount, cents(asset.recordedValue))
  const remaining = remainingToAllocate(amount, allocations)
  const allocatedTotal = subtract(amount, remaining)

  async function handleConfirm() {
    if (remaining < 0) {
      setSubmitError('Os direcionamentos não podem somar mais do que o valor de venda.')
      return
    }
    setSubmitError(undefined)

    // Sequencial de propósito: se um lançamento falhar, os seguintes não são
    // criados e a venda não é enviada — a pessoa corrige e clica de novo.
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

    if (gainAccountId === undefined) {
      setSubmitError('Escolha a conta em que o ganho ou a perda será reconhecido.')
      return
    }

    sell.mutate(
      {
        id: asset.id,
        sale: {
          amount,
          date,
          gainAccountId,
          allocations: allocations.map((allocation) => ({
            kind: allocation.kind,
            target: allocation.target,
            amount: allocation.amount,
          })),
        },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => setSubmitError(errorMessage(error)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 460 de largura: frame 99:39 (Wireframe) e nó "Diálogo" 991:2204 (Mockup). */}
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Vender Bem Material</DialogTitle>
          {/* Figma 99:41: "Civic 2020 · PF · registrado por R$ 45.000,00". */}
          <DialogDescription>
            {asset.name} · {asset.entity} · registrado por {formatMoney(cents(asset.recordedValue))}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Uma coluna, cada campo na largura inteira — os dois frames
           * concordam. Wireframe 99:39 (460 de largura, padding 28): "Valor de
           * venda *" 99:42 em x=28 y=97 w=404 e "Data da venda *" 99:46 em
           * x=28 y=174 w=404 — 404 = 460 − 28×2. Mockup 991:2204 (padding 24):
           * as instâncias "Campo" 991:2208 (x=24 y=92 w=412) e 991:2212
           * (x=24 y=172 w=412), com intervalo vertical 172 − (92+64) = 16, que
           * é o `gap-16` do próprio DialogBody. Estavam num
           * `grid grid-cols-2 gap-16`, lado a lado: ~198 de largura cada
           * contra os 412 desenhados. */}
          <Field label="Valor de venda">
            {(fieldProps) => (
              <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />
            )}
          </Field>
          <Field label="Data da venda">
            {(fieldProps) => (
              <DateField
                {...fieldProps}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            )}
          </Field>

          <div className="flex items-center justify-between rounded-control bg-surface-subtle px-16 py-12">
            <span className="text-style-body-md text-ink-secondary">Ganho/Perda (calculado)</span>
            <span
              className={
                isZero(gainOrLoss)
                  ? 'text-style-numeric-md font-medium text-ink-tertiary'
                  : 'text-style-numeric-md font-medium text-ink-primary'
              }
            >
              {formatMoney(gainOrLoss)}
            </span>
          </div>
          {/* Figma 99:56, word for word. */}
          <p className="text-style-body-sm text-ink-secondary">
            Lançado automaticamente em Resultado Não Operacional.
          </p>

          {/* Campo NÃO desenhado em frame nenhum — decisão de produto de
              2026-09-07 (docs/PERGUNTAS-EM-ABERTO.md P33). O modal prometia o
              lançamento automático acima e ele nunca acontecia, porque todo
              Lançamento exige uma conta e nenhuma tela perguntava qual. Produto
              escolheu pedi-la aqui, em vez de aceitar lançamento sem conta. */}
          <Field label="Conta do ganho/perda">
            {(fieldProps) => (
              <Select value={gainAccountId} onValueChange={setGainAccountId}>
                <SelectTrigger
                  id={fieldProps.id}
                  aria-describedby={fieldProps['aria-describedby']}
                />
                <SelectContent>
                  {(gainAccounts.data?.data.length ?? 0) === 0 ? (
                    <SelectEmpty>Nenhuma conta cadastrada ainda.</SelectEmpty>
                  ) : (
                    gainAccounts.data?.data.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </Field>

          <div className="flex flex-col gap-8">
            <p className="text-style-body-md font-medium text-ink-primary">
              Direcionar valor recebido
            </p>
            {allocations.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {allocations.map((allocation) =>
                  editingId === allocation.id ? (
                    <li key={allocation.id} className="py-4">
                      <AddAllocationForm
                        // The item being edited is excluded from "Restante" —
                        // otherwise its own (already-counted) amount would
                        // shrink the ceiling it is allowed to keep.
                        remaining={add(remaining, allocation.amount)}
                        editing={allocation}
                        onCancel={() => setEditingId(null)}
                        onAdd={(draft) => {
                          setAllocations((prev) =>
                            prev.map((item) => (item.id === draft.id ? draft : item)),
                          )
                          setEditingId(null)
                        }}
                      />
                    </li>
                  ) : (
                    <li
                      key={allocation.id}
                      className="flex h-[var(--height-table-row)] items-center justify-between border-b border-line-default text-style-body-md text-ink-primary last:border-0"
                    >
                      <span>{allocation.label}</span>
                      <div className="flex items-center gap-12">
                        <span className="text-style-numeric-md">
                          {formatMoney(allocation.amount)}
                        </span>
                        {/* Figma 99:2 → 103:12: o frame desenha os DOIS
                         * botões, "Editar" (103:13, x=0) à esquerda de
                         * "Remover" (103:15, x=62), numa única variante de
                         * linha — nenhum dos 130 frames do Wireframe, nem o
                         * Mockup 991:2131, desenha um conjunto de ações
                         * diferente por Tipo, e a nota 103:47 do frame
                         * 103:21 diz que Passivo e Receita são "o mesmo
                         * fluxo". files_design/03 "Objeto Direcionamento" e
                         * files_design/01 §11 repetem: "Editar/Remover cada
                         * um". Editar é seguro nos três Tipos porque a lista
                         * é rascunho até 99:67 (ver topo do arquivo). */}
                        <Button
                          variant="secondary"
                          size="compact"
                          onClick={() => setEditingId(allocation.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="secondary"
                          size="compact"
                          className="text-ink-negative"
                          onClick={() =>
                            setAllocations((prev) =>
                              prev.filter((item) => item.id !== allocation.id),
                            )
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            ) : null}

            {addingOpen ? (
              <AddAllocationForm
                remaining={remaining}
                onCancel={() => setAddingOpen(false)}
                onAdd={(draft) => {
                  setAllocations((prev) => [...prev, draft])
                  setAddingOpen(false)
                }}
              />
            ) : (
              <Button variant="secondary" width="full" onClick={() => setAddingOpen(true)}>
                + Adicionar Direcionamento
              </Button>
            )}

            {/* O resumo FECHA o bloco, e em duas frases — está desenhado aqui,
                neste frame: dentro de `991:2220` a ordem é rótulo `991:2221` →
                "Alocação" `991:2222` → "Divisor" com o "+ Adicionar" `991:2225`
                → "Resumo" `991:2229`, cujos textos são `991:2230` e `991:2231`.
                O código tinha o par no começo e numa linha só.

                As duas frases também resolvem largura, medida no navegador em
                2026-09-11 NESTE diálogo (410 de espaço útil): numa linha só o
                resumo pede 316 já com tudo zerado, 396 com valores realistas e
                517 no teto — nunca coube. Separadas, medem 253 e 134. */}
            <div className="flex flex-col gap-4">
              <p className="text-style-body-sm text-ink-secondary">
                Direcionado: {formatMoney(allocatedTotal)} de {formatMoney(amount)}
              </p>
              <p className="text-style-body-sm text-ink-secondary">
                Restante: {formatMoney(remaining)}
              </p>
            </div>
          </div>

          {/* Figma 103:20, word for word. */}
          <p className="rounded-control bg-surface-subtle px-16 py-12 text-style-body-sm text-ink-secondary">
            O valor restante (não direcionado) fica pendente e aparece em destaque na Home.
          </p>

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
            disabled={sell.isPending || createRevenueEntry.isPending}
            onClick={() => void handleConfirm()}
          >
            {sell.isPending || createRevenueEntry.isPending ? 'Confirmando…' : 'Confirmar Venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddAllocationForm({
  remaining,
  onAdd,
  onCancel,
  editing,
}: {
  remaining: Cents
  onAdd: (draft: DraftAllocation) => void
  onCancel: () => void
  /** Set only from the Editar action (files_design/03 "Objeto
   * Direcionamento" / files_design/01 §11) — seeds every field from the
   * existing draft instead of starting blank, and `handleAdd` replaces that
   * same id instead of appending a new one. Vale para os três Tipos: a linha
   * 103:8 do frame 99:2 desenha "Editar" (103:13) sem variante por Tipo. */
  editing?: DraftAllocation
}) {
  const [kind, setKind] = React.useState<AllocationKind>(editing?.kind ?? 'Investment')
  // Figma 202:20 + nota 103:37: a linha "+ Adicionar" troca de lugar com o
  // formulário completo de cadastro do destino enquanto ele está aberto.
  const [creatingTarget, setCreatingTarget] = React.useState(false)
  const [amount, setAmount] = React.useState<Cents>(editing?.amount ?? ZERO)
  const [error, setError] = React.useState<string | undefined>(undefined)

  // Investimento — "busca/cria inline" (files_design/03). O "cria" NÃO é um
  // formulário reduzido: a nota 103:37 do frame 103:21 diz, palavra por
  // palavra, que o "+ Adicionar" do destino "Abre o formulário completo de
  // cadastro de investimento já existente no produto" — por isso o
  // `SearchCreateField` abaixo é busca pura (sem `onCreate`) e a criação mora
  // na linha 202:20, que monta o `InvestmentForm` de verdade.
  const investmentList = investments.useList()
  const [investmentQuery, setInvestmentQuery] = React.useState('')
  const [investmentTarget, setInvestmentTarget] = React.useState<{
    id: string
    label: string
  } | null>(
    editing?.kind === 'Investment' && editing.target
      ? { id: editing.target, label: editing.targetLabel ?? '' }
      : null,
  )

  // Passivo — busca/filtra igual a Investimento e Categoria
  // (files_design/03 "Objeto Direcionamento": "mesmo padrão de busca/criar
  // categoria — lista completa ao clicar, filtra ao digitar") E cria igual,
  // pelo mesmo caminho: a nota 103:47 do frame 103:21 diz "Passivo funciona
  // igual (buscar + adicionar passivo)". Os 10 campos obrigatórios de um
  // Passivo (files_design/03 "Passivos") são o MOTIVO de o desenho mandar
  // abrir o cadastro completo (103:37), não um motivo para não ter criação.
  const liabilityList = liabilities.useList()
  const [liabilityQuery, setLiabilityQuery] = React.useState('')
  const [liabilityTarget, setLiabilityTarget] = React.useState<{
    id: string
    label: string
  } | null>(
    editing?.kind === 'Liability' && editing.target
      ? { id: editing.target, label: editing.targetLabel ?? '' }
      : null,
  )

  // Receita — "abre o formulário de Receita já existente" (files_design/01 §11).
  // Sem mutação aqui: quem posta é "Confirmar Venda" (99:67), ver topo do
  // arquivo — é o que deixa "Editar" (103:13) valer também para este Tipo.
  const categoryList = categories.useList()
  const bankAccountList = bankAccounts.useList()
  const [revenueStatus, setRevenueStatus] = React.useState<'Planned' | 'Paid'>(
    editing?.revenue?.status ?? 'Paid',
  )
  const [revenueEntity, setRevenueEntity] = React.useState<'PF' | 'PJ'>(
    editing?.revenue?.entity ?? 'PF',
  )
  const [revenueDate, setRevenueDate] = React.useState<string>(
    editing?.revenue?.date ?? todayIsoDate(),
  )
  const [categoryQuery, setCategoryQuery] = React.useState('')
  const [categoryTarget, setCategoryTarget] = React.useState<{ id: string; label: string } | null>(
    editing?.revenue ? { id: editing.revenue.categoryId, label: editing.targetLabel ?? '' } : null,
  )
  const [bankAccountId, setBankAccountId] = React.useState<string | undefined>(
    editing?.revenue?.bankAccountId,
  )

  const investmentItems = (investmentList.data?.data ?? []).map((item) => ({
    id: item.id,
    label: item.name,
  }))
  const matchingInvestments =
    investmentQuery.trim() === ''
      ? investmentItems
      : investmentItems.filter((item) =>
          item.label.toLowerCase().includes(investmentQuery.trim().toLowerCase()),
        )

  const liabilityItems = (liabilityList.data?.data ?? []).map((item) => ({
    id: item.id,
    label: item.name,
  }))
  const matchingLiabilities =
    liabilityQuery.trim() === ''
      ? liabilityItems
      : liabilityItems.filter((item) =>
          item.label.toLowerCase().includes(liabilityQuery.trim().toLowerCase()),
        )

  // Same normalisation `src/domain/chart-of-accounts/rules.ts` uses for the
  // duplicate check (`normalizeForSearch`) — not the domain's own
  // `searchCategories`, which is typed over branded domain ids and this screen
  // only ever holds the wire (plain-string-id) shape of a Category.
  const categoryNeedle = normalizeForSearch(categoryQuery)
  const matchingCategories = (categoryList.data?.data ?? [])
    .filter((category) => !category.archived)
    .filter((category) => normalizeForSearch(category.name).includes(categoryNeedle))
    .map((category) => ({ id: category.id, label: category.name }))

  function handleAdd() {
    if (!fitsWithinRemaining(amount, remaining)) {
      setError(
        amount <= 0
          ? 'Informe um valor maior que zero.'
          : 'O valor a alocar não pode ser maior que o Restante.',
      )
      return
    }

    if (kind === 'Investment') {
      if (investmentTarget === null) {
        setError('Selecione ou crie um investimento de destino.')
        return
      }
      setError(undefined)
      onAdd({
        id: editing?.id ?? crypto.randomUUID(),
        kind: 'Investment',
        target: investmentTarget.id,
        targetLabel: investmentTarget.label,
        amount,
        label: `${LABEL_ALLOCATION_KIND.Investment}: ${investmentTarget.label}`,
        revenue: null,
      })
      return
    }

    if (kind === 'Liability') {
      if (liabilityTarget === null) {
        setError('Selecione um passivo de destino.')
        return
      }
      setError(undefined)
      onAdd({
        id: editing?.id ?? crypto.randomUUID(),
        kind: 'Liability',
        target: liabilityTarget.id,
        targetLabel: liabilityTarget.label,
        amount,
        label: `${LABEL_ALLOCATION_KIND.Liability}: ${liabilityTarget.label}`,
        revenue: null,
      })
      return
    }

    // Revenue
    if (categoryTarget === null || bankAccountId === undefined) {
      setError('Preencha categoria e conta para a receita.')
      return
    }
    setError(undefined)
    onAdd({
      id: editing?.id ?? crypto.randomUUID(),
      kind: 'Revenue',
      target: null,
      targetLabel: categoryTarget.label,
      amount,
      label: `${LABEL_ALLOCATION_KIND.Revenue}: ${categoryTarget.label}`,
      revenue: {
        date: revenueDate,
        status: revenueStatus,
        entity: revenueEntity,
        categoryId: categoryTarget.id,
        bankAccountId,
      },
    })
  }

  return (
    <div className="flex flex-col gap-16 rounded-control border border-line-default p-16">
      {editing ? (
        // Tipo não muda em Editar: trocar de Investimento para Passivo no
        // meio da edição reabriria a pergunta de destino do zero, e para
        // Receita o kind já decidiu qual lançamento foi criado — nenhuma
        // fonte descreve uma migração de tipo aqui.
        <p className="text-style-body-sm text-ink-secondary">
          Tipo: <span className="text-ink-primary">{LABEL_ALLOCATION_KIND[kind]}</span>
        </p>
      ) : (
        <Field label="Tipo" required={false} className="w-fit">
          {(fieldProps) => (
            <SegmentedControl
              {...fieldProps}
              aria-label="Tipo"
              options={ALLOCATION_KINDS.map((value) => ({
                value,
                label: LABEL_ALLOCATION_KIND[value],
              }))}
              value={kind}
              onValueChange={(next) => {
                setKind(next)
                setCreatingTarget(false)
              }}
            />
          )}
        </Field>
      )}

      {/* Figma 103:22: Destino (103:31, y=115) e Valor a alocar (103:38,
          y=192) estão EMPILHADOS, cada um com os 384 de largura cheia do
          painel — não lado a lado. */}
      {kind === 'Investment' ? (
        <div className="flex flex-col gap-16">
          <Field label="Destino">
            {(fieldProps) => (
              <SearchCreateField
                {...fieldProps}
                items={matchingInvestments}
                query={investmentTarget ? investmentTarget.label : investmentQuery}
                onQueryChange={(value) => {
                  setInvestmentTarget(null)
                  setInvestmentQuery(value)
                }}
                onSelect={(item) => setInvestmentTarget(item)}
                // Figma 103:34, palavra por palavra.
                placeholder="Clique para ver a lista de investimentos…"
              />
            )}
          </Field>
          <Field label="Valor a alocar" required={false}>
            {(fieldProps) => (
              <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />
            )}
          </Field>
        </div>
      ) : null}

      {kind === 'Liability' ? (
        <div className="flex flex-col gap-16">
          <Field label="Destino">
            {(fieldProps) => (
              <SearchCreateField
                {...fieldProps}
                items={matchingLiabilities}
                query={liabilityTarget ? liabilityTarget.label : liabilityQuery}
                onQueryChange={(value) => {
                  setLiabilityTarget(null)
                  setLiabilityQuery(value)
                }}
                onSelect={(item) => setLiabilityTarget(item)}
                placeholder="Clique para ver a lista de passivos…"
              />
            )}
          </Field>
          <Field label="Valor a alocar" required={false}>
            {(fieldProps) => (
              <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />
            )}
          </Field>
        </div>
      ) : null}

      {/* Figma 202:20 (y=269): divisor 202:21 à esquerda + botão 103:35
          "+ Adicionar" (texto 103:36) encostado à direita. É a via de criação
          do DESTINO, separada do botão que conclui o direcionamento, e a nota
          103:37 diz o que ela abre: "o formulário completo de cadastro … já
          existente no produto" — daí `InvestmentForm` / `LiabilityForm`, os
          mesmos das telas Investimentos e Passivos, e não uma versão
          reduzida. 103:47: "Passivo funciona igual". */}
      {kind !== 'Revenue' ? (
        creatingTarget ? (
          <div className="rounded-control border border-line-default p-16">
            {kind === 'Investment' ? (
              <InvestmentForm
                columns={2}
                onCancel={() => setCreatingTarget(false)}
                onCreated={(created) => {
                  setInvestmentTarget({ id: created.id, label: created.name })
                  setInvestmentQuery('')
                  setCreatingTarget(false)
                }}
              />
            ) : (
              <LiabilityForm
                columns={2}
                onCancel={() => setCreatingTarget(false)}
                onCreated={(created) => {
                  setLiabilityTarget({ id: created.id, label: created.name })
                  setLiabilityQuery('')
                  setCreatingTarget(false)
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-16">
            <div className="flex-1 border-t border-line-default" />
            <Button variant="secondary" onClick={() => setCreatingTarget(true)}>
              + Adicionar
            </Button>
          </div>
        )
      ) : null}

      {kind === 'Revenue' ? (
        <div className="flex flex-col gap-16">
          <div className="grid grid-cols-2 gap-16">
            <Field label="Valor">
              {(fieldProps) => (
                <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />
              )}
            </Field>
            <Field label="Data do recebimento">
              {(fieldProps) => (
                <DateField
                  {...fieldProps}
                  value={revenueDate}
                  onChange={(event) => setRevenueDate(event.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <Field label="Categoria">
              {(fieldProps) => (
                <SearchCreateField
                  {...fieldProps}
                  items={matchingCategories}
                  query={categoryTarget ? categoryTarget.label : categoryQuery}
                  onQueryChange={(value) => {
                    setCategoryTarget(null)
                    setCategoryQuery(value)
                  }}
                  onSelect={(item) => setCategoryTarget(item)}
                  placeholder="Buscar categoria…"
                />
              )}
            </Field>
            <Field label="Conta">
              {(fieldProps) => (
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger
                    id={fieldProps.id}
                    aria-describedby={fieldProps['aria-describedby']}
                  />
                  <SelectContent>
                    {(bankAccountList.data?.data.length ?? 0) === 0 ? (
                      <SelectEmpty>Nenhuma conta cadastrada ainda.</SelectEmpty>
                    ) : (
                      bankAccountList.data?.data.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <Field label="Entidade" required={false} className="w-fit">
              {(fieldProps) => (
                <SegmentedControl
                  {...fieldProps}
                  aria-label="Entidade"
                  options={ENTITY_OPTIONS}
                  value={revenueEntity}
                  onValueChange={setRevenueEntity}
                />
              )}
            </Field>
            <Field
              label="Status"
              required={false}
              className="w-fit"
              labelExtra={<StatusFieldHelp />}
            >
              {(fieldProps) => (
                <SegmentedControl
                  {...fieldProps}
                  aria-label="Status"
                  options={STATUS_OPTIONS}
                  value={revenueStatus}
                  onValueChange={setRevenueStatus}
                />
              )}
            </Field>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-style-body-sm text-ink-negative">
          {error}
        </p>
      ) : null}

      {/* Figma 103:42 (y=362): "Cancelar" (103:44) e "Direcionar" (103:46) —
          o rodapé fica escondido enquanto o cadastro completo do destino está
          aberto, porque nesse momento quem conclui é o "+ Adicionar" daquele
          formulário e dois "Cancelar" simultâneos não têm desenho nenhum. */}
      {creatingTarget ? null : (
        <div className="flex items-center justify-end gap-8">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            {editing ? 'Salvar' : 'Direcionar'}
          </Button>
        </div>
      )}
    </div>
  )
}

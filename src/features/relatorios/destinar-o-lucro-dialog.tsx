'use client'

/**
 * "Destinar o Lucro" — files_design/01 §9, files_design/03 "Destinar o Lucro",
 * Figma 27:2 (modal), 242:2 (estado de prejuízo, tratado a montante por
 * `hasProfitToAllocate` na página do DRE, que só abre este diálogo quando há
 * lucro a destinar).
 *
 * O lucro líquido do mês é sempre o que o DRE já calculou na base Pago
 * (PRD "Fluxo principal" passo 6) — nunca recomputado aqui. O rascunho local
 * usa as MESMAS regras puras do domínio (`@/domain/profit-allocation`) que o
 * backend usa para validar `PUT`, então "Salvar Destinação" nunca é a
 * primeira vez que a regra "soma não excede o lucro líquido" é aplicada.
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
import { MoneyInput } from '@/components/patterns/money-input'
import { SearchCreateField } from '@/components/patterns/search-create-field'
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Loading } from '@/components/patterns/loading'
import {
  ALLOCATION_BUCKETS,
  LABEL_ALLOCATION_BUCKET,
  addItem,
  bucketItems,
  bucketPercent,
  bucketSubtotal,
  canSave,
  emptyAllocation,
  percentOfProfit,
  removeItem,
  unallocatedBalance,
  unallocatedPercent,
  type AllocationBucket,
  type AllocationDestination,
  type ProfitAllocation,
} from '@/domain/profit-allocation'
import {
  ZERO,
  asId,
  formatMoney,
  formatMonth,
  type BankAccountId,
  type Cents,
  type InvestmentId,
  type Month,
} from '@/domain/core'
import { ApiError } from '@/lib/api-client'
import { bankAccounts } from '../plano-de-contas-e-patrimonio/bank-accounts'
import { investments } from '../plano-de-contas-e-patrimonio/investments'
import type { BankAccount, Investment } from '../plano-de-contas-e-patrimonio/types'
import { useProfitAllocationQuery, useSaveProfitAllocation } from './profit-allocation'

/** Texto de cada card, palavra por palavra do frame Figma 27:2. */
const BUCKET_CAPTION: Record<AllocationBucket, string> = {
  InvestmentContribution: 'Dinheiro novo do lucro deste mês, aplicado pela primeira vez.',
  DividendReinvestment:
    'Rendimento que já veio de um investimento, reaplicado em vez de virar consumo.',
  ExtraordinaryConsumption: 'Gasto pontual fora do orçamento normal, feito com o lucro do mês.',
  CashReserve: 'Fica guardado, disponível, sem virar investimento nem despesa.',
}

const ADD_LABEL: Record<AllocationBucket, string> = {
  InvestmentContribution: '+ Adicionar investimento',
  DividendReinvestment: '+ Adicionar investimento',
  ExtraordinaryConsumption: '+ Adicionar item',
  CashReserve: '+ Adicionar conta',
}

function percentLabel(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível salvar. Tente novamente.'
}

export function DestinarOLucroDialog({
  month,
  netProfit,
  open,
  onOpenChange,
}: {
  month: Month
  netProfit: Cents
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const existing = useProfitAllocationQuery(month, open)
  const save = useSaveProfitAllocation(month)
  // Levantadas aqui (e não só dentro de `BucketCard`) para que o `loading`
  // geral do modal espere as duas também: sem isto, o modal saía do
  // "Carregando destinação" assim que `existing` resolvia, e um item já salvo
  // mostrava o UUID bruto por ~1-2s até estas resolverem (achado de auditoria,
  // reproduzido em teste com a resposta de bank-accounts atrasada).
  const investmentList = investments.useList()
  const bankAccountList = bankAccounts.useList()
  const [draft, setDraft] = React.useState<ProfitAllocation | null>(null)
  const [addingBucket, setAddingBucket] = React.useState<AllocationBucket | null>(null)
  const [submitError, setSubmitError] = React.useState<string | undefined>(undefined)

  // Um mês sem destinação salva ainda (`fetchProfitAllocation` devolve `null`
  // no 404) começa do rascunho vazio, com o MESMO lucro líquido que a página
  // do DRE já mostra — nunca um segundo cálculo.
  React.useEffect(() => {
    if (!open) return
    if (existing.status !== 'success') return
    setDraft(existing.data ?? emptyAllocation(month, netProfit))
    setAddingBucket(null)
    setSubmitError(undefined)
  }, [open, existing.status, existing.data, month, netProfit])

  React.useEffect(() => {
    if (!open) setDraft(null)
  }, [open])

  function handleAdd(
    bucket: AllocationBucket,
    item: { destination: AllocationDestination | null; amount: Cents },
  ) {
    if (draft === null) return
    try {
      setDraft(addItem(draft, bucket, item))
      setAddingBucket(null)
    } catch {
      // `addItem` só recusa quando o valor ultrapassa o restante — o
      // formulário do card já mostra esse erro antes de chamar isto.
    }
  }

  function handleRemove(bucket: AllocationBucket, index: number) {
    if (draft === null) return
    setDraft(removeItem(draft, bucket, index))
  }

  function handleSave() {
    if (draft === null) return
    setSubmitError(undefined)
    save.mutate(draft.items, {
      onSuccess: () => onOpenChange(false),
      onError: (error) => setSubmitError(errorMessage(error)),
    })
  }

  const loading =
    draft === null ||
    existing.status === 'pending' ||
    investmentList.isPending ||
    bankAccountList.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 575 de largura: frame 27:29 (Wireframe) e nó "Diálogo" 997:2505 (Mockup) — o
          diálogo mais largo do produto. */}
      <DialogContent width="wide">
        <DialogHeader>
          <DialogTitle>Destinar o Lucro</DialogTitle>
          <DialogDescription>{formatMonth(month)}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {loading ? (
            <Loading label="Carregando destinação" lines={4} />
          ) : existing.status === 'error' ? (
            <p role="alert" className="text-style-body-sm text-ink-negative">
              Não foi possível carregar a destinação deste mês.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-control bg-surface-subtle px-16 py-12">
                <span className="text-style-body-md text-ink-secondary">Lucro líquido do mês</span>
                <span className="text-style-numeric-md font-medium text-ink-primary">
                  {formatMoney(draft.netProfit)}
                </span>
              </div>

              {ALLOCATION_BUCKETS.map((bucket) => (
                <BucketCard
                  key={bucket}
                  bucket={bucket}
                  allocation={draft}
                  investmentList={investmentList.data?.data ?? []}
                  bankAccountList={bankAccountList.data?.data ?? []}
                  adding={addingBucket === bucket}
                  onStartAdding={() => setAddingBucket(bucket)}
                  onCancelAdding={() => setAddingBucket(null)}
                  onAdd={(item) => handleAdd(bucket, item)}
                  onRemove={(index) => handleRemove(bucket, index)}
                />
              ))}

              <div className="flex items-center justify-between rounded-control bg-surface-subtle px-16 py-12">
                <span className="text-style-body-md text-ink-secondary">Saldo não alocado</span>
                <div className="flex items-center gap-8">
                  <span className="text-style-numeric-md font-medium text-ink-primary">
                    {formatMoney(unallocatedBalance(draft))}
                  </span>
                  <span className="rounded-pill bg-surface-canvas px-8 py-4 text-style-label-xs text-ink-secondary">
                    {percentLabel(unallocatedPercent(draft))}
                  </span>
                </div>
              </div>

              {submitError ? (
                <p role="alert" className="text-style-body-sm text-ink-negative">
                  {submitError}
                </p>
              ) : null}

              <RequiredFieldLegend />
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={loading || existing.status === 'error' || !canSave(draft!) || save.isPending}
            onClick={handleSave}
          >
            {save.isPending ? 'Salvando…' : 'Salvar Destinação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BucketCard({
  bucket,
  allocation,
  investmentList,
  bankAccountList,
  adding,
  onStartAdding,
  onCancelAdding,
  onAdd,
  onRemove,
}: {
  bucket: AllocationBucket
  allocation: ProfitAllocation
  investmentList: readonly Investment[]
  bankAccountList: readonly BankAccount[]
  adding: boolean
  onStartAdding: () => void
  onCancelAdding: () => void
  onAdd: (item: { destination: AllocationDestination | null; amount: Cents }) => void
  onRemove: (index: number) => void
}) {
  const items = bucketItems(allocation, bucket)
  const subtotal = bucketSubtotal(allocation, bucket)
  const percent = bucketPercent(allocation, bucket)

  // Só o id sobrevive no `AllocationDestination` guardado no rascunho — o
  // nome pra exibir vem destas mesmas listas que o formulário de adição usa
  // (TanStack Query compartilha o cache), já resolvidas pelo componente pai:
  // o `loading` do diálogo espera as duas antes de montar este card, então
  // não há mais janela em que o mapa está vazio e o id bruto aparece.
  const investmentLabelById = new Map(investmentList.map((item) => [item.id, item.name]))
  const bankAccountLabelById = new Map(bankAccountList.map((item) => [item.id, item.label]))

  return (
    <div className="flex flex-col gap-12 rounded-control border border-line-default p-16">
      <div className="flex items-center justify-between">
        <p className="text-style-body-md font-medium text-ink-primary">
          {LABEL_ALLOCATION_BUCKET[bucket]}
        </p>
        <p className="text-style-body-sm text-ink-secondary">
          {formatMoney(subtotal)} · {percentLabel(percent)} do lucro
        </p>
      </div>
      <p className="text-style-body-sm text-ink-secondary">{BUCKET_CAPTION[bucket]}</p>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex h-[var(--height-table-row)] items-center justify-between border-b border-line-default text-style-body-md text-ink-primary last:border-0"
            >
              <span>
                {destinationLabel(item.destination, investmentLabelById, bankAccountLabelById)}
              </span>
              <div className="flex items-center gap-12">
                <span className="text-style-numeric-md">{formatMoney(item.amount)}</span>
                {/* files_design/01 §9: "cada item também mostra sua própria %
                    do lucro" — não só o subtotal do card (Figma 27:2, nodes
                    245:14/15 "24%" ao lado de Tesouro Direto). */}
                <span className="rounded-pill bg-surface-canvas px-8 py-4 text-style-label-xs text-ink-secondary">
                  {percentLabel(percentOfProfit(allocation, item.amount))}
                </span>
                <Button
                  variant="secondary"
                  size="compact"
                  className="text-ink-negative"
                  onClick={() => onRemove(index)}
                >
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddItemForm bucket={bucket} onAdd={onAdd} onCancel={onCancelAdding} />
      ) : (
        <Button variant="secondary" width="full" onClick={onStartAdding}>
          {ADD_LABEL[bucket]}
        </Button>
      )}
    </div>
  )
}

function destinationLabel(
  destination: AllocationDestination | null,
  investmentLabelById: ReadonlyMap<string, string>,
  bankAccountLabelById: ReadonlyMap<string, string>,
): string {
  if (destination === null) return '—'
  if (destination.kind === 'FreeText') return destination.name
  if (destination.kind === 'Investment') {
    return investmentLabelById.get(destination.investmentId) ?? destination.investmentId
  }
  return bankAccountLabelById.get(destination.bankAccountId) ?? destination.bankAccountId
}

function AddItemForm({
  bucket,
  onAdd,
  onCancel,
}: {
  bucket: AllocationBucket
  onAdd: (item: { destination: AllocationDestination | null; amount: Cents }) => void
  onCancel: () => void
}) {
  const [amount, setAmount] = React.useState<Cents>(ZERO)
  const [error, setError] = React.useState<string | undefined>(undefined)

  // Investimento — "busca/cria inline" (files_design/03), igual ao mesmo
  // padrão em Vender Bem Material.
  const investmentList = investments.useList()
  const createInvestment = investments.useCreate()
  const [investmentQuery, setInvestmentQuery] = React.useState('')
  const [investmentTarget, setInvestmentTarget] = React.useState<{
    id: string
    label: string
  } | null>(null)

  const bankAccountList = bankAccounts.useList()
  const [bankAccountId, setBankAccountId] = React.useState<string | undefined>(undefined)

  const [freeTextName, setFreeTextName] = React.useState('')

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

  function handleAdd() {
    if (amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }

    if (bucket === 'InvestmentContribution' || bucket === 'DividendReinvestment') {
      if (investmentTarget === null) {
        setError('Selecione ou crie um investimento de destino.')
        return
      }
      setError(undefined)
      onAdd({
        destination: { kind: 'Investment', investmentId: asId<InvestmentId>(investmentTarget.id) },
        amount,
      })
      return
    }

    if (bucket === 'CashReserve') {
      if (bankAccountId === undefined) {
        setError('Selecione uma conta de destino.')
        return
      }
      setError(undefined)
      onAdd({
        destination: { kind: 'BankAccount', bankAccountId: asId<BankAccountId>(bankAccountId) },
        amount,
      })
      return
    }

    // ExtraordinaryConsumption
    if (freeTextName.trim() === '') {
      setError('Descreva o gasto.')
      return
    }
    setError(undefined)
    onAdd({ destination: { kind: 'FreeText', name: freeTextName.trim() }, amount })
  }

  return (
    <div className="flex flex-col gap-16 rounded-control bg-surface-subtle p-12">
      <p className="text-style-body-sm text-ink-secondary">Novo item</p>
      <div className="grid grid-cols-2 gap-16">
        {bucket === 'InvestmentContribution' || bucket === 'DividendReinvestment' ? (
          <Field label="Investimento">
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
                onCreate={(name) =>
                  createInvestment.mutate(
                    { name, entity: 'PF', accumulatedValue: 0 },
                    {
                      onSuccess: (created) =>
                        setInvestmentTarget({ id: created.id, label: created.name }),
                    },
                  )
                }
                placeholder="Buscar investimento ou + criar novo…"
                createLabel={(term) => `+ Criar investimento "${term}"`}
              />
            )}
          </Field>
        ) : null}

        {bucket === 'CashReserve' ? (
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
        ) : null}

        {bucket === 'ExtraordinaryConsumption' ? (
          <Field label="Descrição">
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="text"
                value={freeTextName}
                onChange={(event) => setFreeTextName(event.target.value)}
                placeholder="Ex.: Viagem"
                className="h-[var(--height-control)] rounded-control border border-line-default bg-surface-card px-12 text-style-body-md text-ink-primary outline-none focus-visible:border-line-focus"
              />
            )}
          </Field>
        ) : null}

        <Field label="Valor" required={false}>
          {(fieldProps) => <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />}
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-style-body-sm text-ink-negative">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-8">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" disabled={createInvestment.isPending} onClick={handleAdd}>
          Adicionar
        </Button>
      </div>
    </div>
  )
}

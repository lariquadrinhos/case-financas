'use client'

import * as React from 'react'
import { OnboardingStepShell } from '@/components/patterns/onboarding-shell'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { ErrorState, MutationError } from '@/components/patterns/error-state'
import { ItemRowActions } from '@/components/patterns/item-row-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { investments } from '@/features/plano-de-contas-e-patrimonio/investments'
import type { Investment, NewInvestment } from '@/features/plano-de-contas-e-patrimonio/types'
import { cents, formatMoney, ZERO, type Cents, type Entity } from '@/domain/core'

interface DraftInvestment {
  name: string
  entity: Entity
  accumulatedValue: Cents
}

function emptyDraft(): DraftInvestment {
  return { name: '', entity: 'PF', accumulatedValue: ZERO }
}

/** Onboarding 4 — Investimentos. files_design/01 §3.4, Figma 29:133. */
export default function InvestimentosPage() {
  const list = investments.useList()
  const create = investments.useCreate()
  const items = list.data?.data ?? []

  return (
    <OnboardingStepShell
      step={4}
      stepLabel="Investimentos"
      title="Cadastre seus investimentos"
      description={
        <p>Cadastre o valor acumulado até hoje em investimentos, como: ações, bitcoin, etf...</p>
      }
      requiredLegend
    >
      {list.isLoading ? (
        <Loading label="Carregando investimentos" bars={SKELETON_BARS.INVESTIMENTOS} />
      ) : list.isError ? (
        <ErrorState
          message="Não foi possível carregar seus investimentos. Verifique sua conexão e tente de novo."
          onRetry={() => void list.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {items.map((item) => (
            <InvestmentRow key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        <p className="text-style-body-md font-medium text-ink-primary">Adicionar investimento</p>
        <InvestmentForm
          submitLabel="+ Adicionar"
          pending={create.isPending}
          error={create.error}
          onSubmit={(draft, { reset }) => {
            const body: NewInvestment = {
              name: draft.name,
              entity: draft.entity,
              accumulatedValue: draft.accumulatedValue,
            }
            create.mutate(body, { onSuccess: reset })
          }}
        />
      </div>
    </OnboardingStepShell>
  )
}

function InvestmentRow({ item }: { item: Investment }) {
  const [editing, setEditing] = React.useState(false)
  const patch = investments.usePatch()
  const remove = investments.useRemove()

  if (editing) {
    return (
      <div className="rounded-control border border-line-default p-16">
        <InvestmentForm
          initial={{
            name: item.name,
            entity: item.entity,
            accumulatedValue: cents(item.accumulatedValue),
          }}
          submitLabel="Salvar"
          pending={patch.isPending}
          error={patch.error}
          onCancel={() => setEditing(false)}
          onSubmit={(draft) => {
            patch.mutate({ id: item.id, body: draft }, { onSuccess: () => setEditing(false) })
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-16 rounded-control bg-surface-subtle px-16 py-12">
        <div className="flex flex-1 items-center gap-12">
          <span className="text-style-body-md text-ink-primary">{item.name}</span>
          <span className="text-style-body-md text-ink-secondary">{item.entity}</span>
          <span className="ml-auto text-style-numeric-md text-ink-primary">
            {formatMoney(cents(item.accumulatedValue))}
          </span>
        </div>
        <ItemRowActions onEdit={() => setEditing(true)} onDiscard={() => remove.mutate(item.id)} />
      </div>
      {/* `DELETE` answers 409 when the record is already referenced
          (`bank_accounts.in_use`, `liabilities.in_use`, `investments.in_use`).
          Without this the row just stays put and "Descartar" looks broken. */}
      <MutationError error={remove.error} />
    </div>
  )
}

function InvestmentForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: DraftInvestment
  submitLabel: string
  pending: boolean
  /** The failed create/patch this form triggered, if any — surfaced in place. */
  error?: unknown
  onSubmit: (draft: DraftInvestment, helpers: { reset: () => void }) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = React.useState<DraftInvestment>(initial ?? emptyDraft())

  function reset() {
    setDraft(emptyDraft())
  }

  const canSubmit = draft.name.trim() !== '' && !pending

  return (
    <div className="flex flex-wrap items-end gap-16">
      <Field label="Nome" className="w-[var(--width-field-name-investment)]">
        {(props) => (
          <Input
            {...props}
            placeholder="Ex: Tesouro Direto"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        )}
      </Field>

      <Field label="Entidade" required={false}>
        {(props) => (
          <SegmentedControl
            {...props}
            aria-label="Entidade"
            value={draft.entity}
            onValueChange={(entity) => setDraft({ ...draft, entity })}
            options={[
              { value: 'PF', label: 'PF' },
              { value: 'PJ', label: 'PJ' },
            ]}
          />
        )}
      </Field>

      {/* files_design/03 lists this field as "Obrigatório: sim", and the Figma
          text (29:158) simply omits the " *" that "Saldo" (29:64) omits too —
          the same divergence in both, on fields doc03 marks required. doc03 is
          the source of truth for obrigatoriedade, so the asterisk stays here,
          the way it already does on Contas Bancárias/Saldo and on the
          post-onboarding Investimentos screen: one rule across the product,
          not one per screen. */}
      <Field label="Valor inicial acumulado" className="w-[var(--width-field-money-investment)]">
        {(props) => (
          <MoneyInput
            {...props}
            value={draft.accumulatedValue}
            onValueChange={(accumulatedValue) => setDraft({ ...draft, accumulatedValue })}
          />
        )}
      </Field>

      <MutationError error={error} />

      <div className="ml-auto flex items-center gap-8">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button variant="primary" disabled={!canSubmit} onClick={() => onSubmit(draft, { reset })}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

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
import { tangibleAssets } from '@/features/plano-de-contas-e-patrimonio/tangible-assets'
import type { NewTangibleAsset, TangibleAsset } from '@/features/plano-de-contas-e-patrimonio/types'
import { cents, formatMoney, ZERO, type Cents, type Entity } from '@/domain/core'

interface DraftTangibleAsset {
  name: string
  entity: Entity
  recordedValue: Cents
}

function emptyDraft(): DraftTangibleAsset {
  return { name: '', entity: 'PF', recordedValue: ZERO }
}

/** Onboarding 3 — Bens Materiais. files_design/01 §3.3, Figma 29:86. */
export default function BensMateriaisPage() {
  const list = tangibleAssets.useList()
  const create = tangibleAssets.useCreate()
  const items = list.data?.data ?? []

  return (
    <OnboardingStepShell
      step={3}
      stepLabel="Bens Materiais"
      title="Cadastre seus bens materiais"
      description={
        <p>Imóvel, veículo, equipamentos, o que tiver valor. Nome livre, sem categoria fixa.</p>
      }
      requiredLegend
    >
      {list.isLoading ? (
        <Loading label="Carregando bens materiais" bars={SKELETON_BARS.BENS_MATERIAIS} />
      ) : list.isError ? (
        <ErrorState
          message="Não foi possível carregar seus bens. Verifique sua conexão e tente de novo."
          onRetry={() => void list.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {items.map((item) => (
            <TangibleAssetRow key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        <p className="text-style-body-md font-medium text-ink-primary">Adicionar bem material</p>
        <TangibleAssetForm
          submitLabel="+ Adicionar"
          pending={create.isPending}
          error={create.error}
          onSubmit={(draft, { reset }) => {
            const body: NewTangibleAsset = {
              name: draft.name,
              entity: draft.entity,
              recordedValue: draft.recordedValue,
            }
            create.mutate(body, { onSuccess: reset })
          }}
        />
      </div>
    </OnboardingStepShell>
  )
}

function TangibleAssetRow({ item }: { item: TangibleAsset }) {
  const [editing, setEditing] = React.useState(false)
  const patch = tangibleAssets.usePatch()
  const remove = tangibleAssets.useRemove()

  if (editing) {
    return (
      <div className="rounded-control border border-line-default p-16">
        <TangibleAssetForm
          initial={{
            name: item.name,
            entity: item.entity,
            recordedValue: cents(item.recordedValue),
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
            {formatMoney(cents(item.recordedValue))}
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

function TangibleAssetForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: DraftTangibleAsset
  submitLabel: string
  pending: boolean
  /** The failed create/patch this form triggered, if any — surfaced in place. */
  error?: unknown
  onSubmit: (draft: DraftTangibleAsset, helpers: { reset: () => void }) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = React.useState<DraftTangibleAsset>(initial ?? emptyDraft())

  function reset() {
    setDraft(emptyDraft())
  }

  const canSubmit = draft.name.trim() !== '' && !pending

  return (
    <div className="flex flex-wrap items-end gap-16">
      <Field label="Nome" className="w-[var(--width-field-name-asset)]">
        {(props) => (
          <Input
            {...props}
            placeholder="Ex: Apartamento Centro"
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

      <Field label="Valor inicial" className="w-[var(--width-field-money-asset)]">
        {(props) => (
          <MoneyInput
            {...props}
            value={draft.recordedValue}
            onValueChange={(recordedValue) => setDraft({ ...draft, recordedValue })}
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

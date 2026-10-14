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
import { DateField } from '@/components/patterns/date-field'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { ClassificationFieldHelp } from '@/components/patterns/field-help'
import { liabilities } from '@/features/plano-de-contas-e-patrimonio/liabilities'
import type { Liability, NewLiability } from '@/features/plano-de-contas-e-patrimonio/types'
import {
  cents,
  formatMoney,
  isoDate,
  LABEL_CLASSIFICATION,
  ZERO,
  type Cents,
  type Classification,
  type Entity,
  type IsoDate,
} from '@/domain/core'
import {
  PercentInput,
  formatPercentText,
  parsePercentText,
} from '@/features/plano-de-contas-e-patrimonio/percent-input'
import { nextClassification } from './_lib/classification-suggestion'

interface DraftLiability {
  name: string
  creditor: string
  entity: Entity
  classification: Classification
  classificationTouched: boolean
  originalAmount: Cents
  installmentAmount: Cents
  installmentCountText: string
  installmentsAlreadyPaidText: string
  monthlyInterestRateText: string
  startDate: string
}

function emptyDraft(): DraftLiability {
  return {
    name: '',
    creditor: '',
    entity: 'PF',
    classification: 'NonCurrent',
    classificationTouched: false,
    originalAmount: ZERO,
    installmentAmount: ZERO,
    installmentCountText: '',
    installmentsAlreadyPaidText: '0',
    monthlyInterestRateText: '',
    startDate: '',
  }
}

function parseWholeNumber(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 ? value : null
}

/** Onboarding 5 — Passivos. files_design/01 §3.5, Figma 29:180. */
export default function PassivosPage() {
  const list = liabilities.useList()
  const create = liabilities.useCreate()
  const items = list.data?.data ?? []

  return (
    <OnboardingStepShell
      step={5}
      stepLabel="Passivos"
      title="Cadastre seus passivos"
      description={
        <p>Dívidas e financiamentos. A classificação é sugerida automaticamente pelo nome.</p>
      }
      requiredLegend
      wide
    >
      {list.isLoading ? (
        <Loading label="Carregando passivos" bars={SKELETON_BARS.PASSIVOS} />
      ) : list.isError ? (
        <ErrorState
          message="Não foi possível carregar seus passivos. Verifique sua conexão e tente de novo."
          onRetry={() => void list.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {items.map((item) => (
            <LiabilityRow key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        <p className="text-style-body-md font-medium text-ink-primary">Adicionar passivo</p>
        <LiabilityForm
          submitLabel="+ Adicionar"
          pending={create.isPending}
          error={create.error}
          onSubmit={(body, { reset }) => {
            create.mutate(body, { onSuccess: reset })
          }}
        />
      </div>
    </OnboardingStepShell>
  )
}

function LiabilityRow({ item }: { item: Liability }) {
  const [editing, setEditing] = React.useState(false)
  const patch = liabilities.usePatch()
  const remove = liabilities.useRemove()

  if (editing) {
    return (
      <div className="rounded-control border border-line-default p-16">
        <LiabilityForm
          initial={{
            name: item.name,
            creditor: item.creditor,
            entity: item.entity,
            classification: item.classification,
            classificationTouched: true,
            originalAmount: cents(item.originalAmount),
            installmentAmount: cents(item.installmentAmount),
            installmentCountText: String(item.installmentCount),
            installmentsAlreadyPaidText: String(item.installmentsAlreadyPaid),
            monthlyInterestRateText: formatPercentText(item.monthlyInterestRate),
            startDate: item.startDate,
          }}
          submitLabel="Salvar"
          pending={patch.isPending}
          error={patch.error}
          onCancel={() => setEditing(false)}
          onSubmit={(body) => {
            patch.mutate({ id: item.id, body }, { onSuccess: () => setEditing(false) })
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
          <span className="text-style-body-md text-ink-secondary">
            {LABEL_CLASSIFICATION[item.classification]}
          </span>
          <span className="ml-auto text-style-numeric-md text-ink-primary">
            {formatMoney(cents(item.originalAmount))}
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

function LiabilityForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: DraftLiability
  submitLabel: string
  pending: boolean
  /** The failed create/patch this form triggered, if any — surfaced in place. */
  error?: unknown
  onSubmit: (body: NewLiability, helpers: { reset: () => void }) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = React.useState<DraftLiability>(initial ?? emptyDraft())

  function reset() {
    setDraft(emptyDraft())
  }

  function updateName(name: string) {
    setDraft((current) => ({
      ...current,
      name,
      classification: nextClassification({
        name,
        touched: current.classificationTouched,
        current: current.classification,
      }),
    }))
  }

  const installmentCount = parseWholeNumber(draft.installmentCountText)
  const installmentsAlreadyPaid = parseWholeNumber(draft.installmentsAlreadyPaidText)
  /**
   * files_design/03 lists "Taxa de juros (a.m.)" as obrigatório, and the whole
   * amortisation schedule is generated from it — an empty or unparseable field
   * silently becoming 0% would create a Passivo whose parcelas carry no
   * interest at all, with nothing on screen saying so. `parsePercentText`
   * answers `null` for exactly those cases, so the rate gates "+ Adicionar"
   * the same way it gates the post-onboarding Passivos screen.
   */
  const monthlyInterestRate = parsePercentText(draft.monthlyInterestRateText)
  const startDateValid = draft.startDate.trim() !== ''

  const canSubmit =
    !pending &&
    draft.name.trim() !== '' &&
    draft.creditor.trim() !== '' &&
    installmentCount !== null &&
    installmentCount >= 1 &&
    installmentsAlreadyPaid !== null &&
    installmentsAlreadyPaid <= installmentCount &&
    monthlyInterestRate !== null &&
    startDateValid

  function submit() {
    if (
      !canSubmit ||
      installmentCount === null ||
      installmentsAlreadyPaid === null ||
      monthlyInterestRate === null
    )
      return
    const body: NewLiability = {
      name: draft.name,
      creditor: draft.creditor,
      entity: draft.entity,
      classification: draft.classification,
      originalAmount: draft.originalAmount,
      installmentAmount: draft.installmentAmount,
      installmentCount,
      installmentsAlreadyPaid,
      monthlyInterestRate,
      startDate: isoDate(draft.startDate) as IsoDate,
    }
    onSubmit(body, { reset })
  }

  return (
    <div className="flex flex-col gap-16">
      <div className="grid grid-cols-3 gap-16">
        <Field label="Nome">
          {(props) => (
            <Input
              {...props}
              placeholder="Ex: Financiamento apartamento"
              value={draft.name}
              onChange={(event) => updateName(event.target.value)}
            />
          )}
        </Field>
        <Field label="Credor / Instituição">
          {(props) => (
            <Input
              {...props}
              placeholder="Ex: Caixa Econômica"
              value={draft.creditor}
              onChange={(event) => setDraft({ ...draft, creditor: event.target.value })}
            />
          )}
        </Field>
        <Field label="Entidade" required={false}>
          {(props) => (
            <SegmentedControl
              {...props}
              aria-label="Entidade"
              fullWidth
              value={draft.entity}
              onValueChange={(entity) => setDraft({ ...draft, entity })}
              options={[
                { value: 'PF', label: 'PF' },
                { value: 'PJ', label: 'PJ' },
              ]}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-16">
        <Field label="Valor original da dívida">
          {(props) => (
            <MoneyInput
              {...props}
              value={draft.originalAmount}
              onValueChange={(originalAmount) => setDraft({ ...draft, originalAmount })}
            />
          )}
        </Field>
        <Field label="Valor da parcela">
          {(props) => (
            <MoneyInput
              {...props}
              value={draft.installmentAmount}
              onValueChange={(installmentAmount) => setDraft({ ...draft, installmentAmount })}
            />
          )}
        </Field>
        <Field
          label="Número de parcelas"
          error={
            draft.installmentCountText !== '' && installmentCount === null
              ? 'Digite um número inteiro maior que zero.'
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              inputMode="numeric"
              placeholder="Ex: 360"
              value={draft.installmentCountText}
              onChange={(event) => setDraft({ ...draft, installmentCountText: event.target.value })}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-16">
        <Field
          label="Parcelas já pagas"
          error={
            installmentCount !== null &&
            installmentsAlreadyPaid !== null &&
            installmentsAlreadyPaid > installmentCount
              ? 'Não pode ser maior que o número de parcelas.'
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              inputMode="numeric"
              placeholder="Ex: 12"
              value={draft.installmentsAlreadyPaidText}
              onChange={(event) =>
                setDraft({ ...draft, installmentsAlreadyPaidText: event.target.value })
              }
            />
          )}
        </Field>
        <Field
          label="Taxa de juros (a.m.)"
          error={
            draft.monthlyInterestRateText !== '' && monthlyInterestRate === null
              ? 'Digite a taxa mensal, como 0,85.'
              : undefined
          }
        >
          {(props) => (
            <PercentInput
              {...props}
              placeholder="Ex: 0,85%"
              value={draft.monthlyInterestRateText}
              onValueChange={(monthlyInterestRateText) =>
                setDraft({ ...draft, monthlyInterestRateText })
              }
            />
          )}
        </Field>
        {/* Figma 95:42 draws the calendar glyph inside this field (201:5) —
            `DateField` is the component that carries it, and the one every
            other date field in the product already uses. */}
        <Field label="Data de início">
          {(props) => (
            <DateField
              {...props}
              value={draft.startDate}
              onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
            />
          )}
        </Field>
      </div>

      <Field
        label="Classificação (sugerida)"
        required={false}
        labelExtra={<ClassificationFieldHelp withSuggestionNote />}
      >
        {(props) => (
          <SegmentedControl
            {...props}
            aria-label="Classificação (sugerida)"
            fullWidth
            value={draft.classification}
            onValueChange={(classification) =>
              setDraft({ ...draft, classification, classificationTouched: true })
            }
            options={[
              { value: 'Current', label: 'Circulante' },
              { value: 'NonCurrent', label: 'Não circulante' },
            ]}
          />
        )}
      </Field>

      <MutationError error={error} />

      <div className="flex items-center justify-end gap-8">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button variant="primary" disabled={!canSubmit} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

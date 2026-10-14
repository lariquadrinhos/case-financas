'use client'

/**
 * O formulário COMPLETO de cadastro de passivo — Figma 40:2, seção 90:7
 * "Adicionar passivo" (linhas 90:8, 90:24, 90:37 e 90:50).
 *
 * Vive aqui, e não dentro de `screens/passivos.tsx`, pelo mesmo motivo do
 * `InvestmentForm`: a nota 103:47 do frame 103:21 diz "Passivo funciona igual
 * (buscar + adicionar passivo)" e a nota 103:37 diz que esse "adicionar" abre
 * "o formulário completo de cadastro … já existente no produto". Reaproveitar
 * é o desenho; duplicar (ou reduzir) não é.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { DateField } from '@/components/patterns/date-field'
import { suggestClassification } from '@/domain/chart-of-accounts'
import { LABEL_CLASSIFICATION, type Classification } from '@/domain/core/vocabulary'
import { ZERO, type Cents } from '@/domain/core'
import { ClassificationFieldHelp } from '@/components/patterns/field-help'
import { ApiError } from '@/lib/api-client'
import { liabilities } from './liabilities'
import { PercentInput, parsePercentText } from './percent-input'
import { todayIsoDate } from './today'
import type { Liability } from './types'

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

const CLASSIFICATION_OPTIONS = [
  { value: 'Current' as const, label: LABEL_CLASSIFICATION.Current },
  { value: 'NonCurrent' as const, label: LABEL_CLASSIFICATION.NonCurrent },
]

interface FormState {
  name: string
  creditor: string
  entity: 'PF' | 'PJ'
  classification: Classification
  originalAmount: Cents
  installmentAmount: Cents
  installmentCountText: string
  installmentsAlreadyPaidText: string
  interestRateText: string
  startDate: string
}

function emptyForm(): FormState {
  return {
    name: '',
    creditor: '',
    entity: 'PF',
    classification: 'NonCurrent',
    originalAmount: ZERO,
    installmentAmount: ZERO,
    installmentCountText: '',
    installmentsAlreadyPaidText: '0',
    interestRateText: '',
    startDate: todayIsoDate(),
  }
}

// Tailwind só enxerga classe literal: o mapa existe para que `grid-cols-2` e
// `grid-cols-3` cheguem ao CSS gerado.
const GRID_COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3' } as const

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível salvar. Tente novamente.'
}

export function LiabilityForm({
  columns = 3,
  onCreated,
  onCancel,
}: {
  /** 3 na tela Passivos (Figma 40:2 / 90:7); 2 dentro do modal de venda. */
  columns?: 2 | 3
  onCreated?: (created: Liability) => void
  onCancel?: () => void
}) {
  const create = liabilities.useCreate()
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [classificationTouched, setClassificationTouched] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const grid = `grid gap-16 ${GRID_COLUMNS[columns]}`

  function handleNameChange(name: string) {
    setForm((prev) => {
      if (classificationTouched) return { ...prev, name }
      const suggested = suggestClassification(name)
      return suggested === null ? { ...prev, name } : { ...prev, name, classification: suggested }
    })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    const creditor = form.creditor.trim()
    const installmentCount = Number.parseInt(form.installmentCountText, 10)
    const installmentsAlreadyPaid = Number.parseInt(form.installmentsAlreadyPaidText || '0', 10)
    const monthlyInterestRate = parsePercentText(form.interestRateText)

    if (name === '' || creditor === '') {
      setError('Preencha nome e credor/instituição.')
      return
    }
    if (!Number.isInteger(installmentCount) || installmentCount < 1) {
      setError('Informe o número de parcelas.')
      return
    }
    if (!Number.isInteger(installmentsAlreadyPaid) || installmentsAlreadyPaid < 0) {
      setError('Parcelas já pagas precisa ser um número válido.')
      return
    }
    if (installmentsAlreadyPaid > installmentCount) {
      setError('Parcelas já pagas não pode ser maior que o número de parcelas.')
      return
    }
    if (monthlyInterestRate === null) {
      setError('Informe a taxa de juros mensal.')
      return
    }
    setError(undefined)

    create.mutate(
      {
        name,
        creditor,
        entity: form.entity,
        classification: form.classification,
        originalAmount: form.originalAmount,
        installmentAmount: form.installmentAmount,
        installmentCount,
        installmentsAlreadyPaid,
        monthlyInterestRate,
        startDate: form.startDate,
      },
      {
        onSuccess: (created) => {
          setForm(emptyForm())
          setClassificationTouched(false)
          onCreated?.(created)
        },
      },
    )
  }

  return (
    <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
      {/* As 4 linhas abaixo seguem os 4 nós-linha do Figma 40:2:
          90:8 (Nome/Credor/Entidade), 90:24 (Valor original/Valor da
          parcela/Número de parcelas), 90:37 (Parcelas já pagas/Taxa de
          juros/Data de início) e 90:50 (Classificação, sozinha, por
          último). */}
      <div className={grid}>
        <Field label="Nome">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Ex: Financiamento apartamento"
            />
          )}
        </Field>
        <Field label="Credor / Instituição">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={form.creditor}
              onChange={(event) => setForm((prev) => ({ ...prev, creditor: event.target.value }))}
              placeholder="Ex: Caixa Econômica"
            />
          )}
        </Field>
        <Field label="Entidade" required={false} className="w-fit">
          {(fieldProps) => (
            <SegmentedControl
              {...fieldProps}
              aria-label="Entidade"
              options={ENTITY_OPTIONS}
              value={form.entity}
              onValueChange={(entity) => setForm((prev) => ({ ...prev, entity }))}
            />
          )}
        </Field>
      </div>
      <div className={grid}>
        <Field label="Valor original da dívida">
          {(fieldProps) => (
            <MoneyInput
              {...fieldProps}
              value={form.originalAmount}
              onValueChange={(originalAmount) => setForm((prev) => ({ ...prev, originalAmount }))}
            />
          )}
        </Field>
        <Field label="Valor da parcela">
          {(fieldProps) => (
            <MoneyInput
              {...fieldProps}
              value={form.installmentAmount}
              onValueChange={(installmentAmount) =>
                setForm((prev) => ({ ...prev, installmentAmount }))
              }
            />
          )}
        </Field>
        <Field label="Número de parcelas">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              inputMode="numeric"
              value={form.installmentCountText}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, installmentCountText: event.target.value }))
              }
              placeholder="Ex: 360"
            />
          )}
        </Field>
      </div>
      <div className={grid}>
        <Field label="Parcelas já pagas">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              inputMode="numeric"
              placeholder="Ex: 12"
              value={form.installmentsAlreadyPaidText}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  installmentsAlreadyPaidText: event.target.value,
                }))
              }
            />
          )}
        </Field>
        <Field label="Taxa de juros (a.m.)">
          {(fieldProps) => (
            <PercentInput
              {...fieldProps}
              value={form.interestRateText}
              onValueChange={(interestRateText) =>
                setForm((prev) => ({ ...prev, interestRateText }))
              }
            />
          )}
        </Field>
        <Field label="Data de início">
          {(fieldProps) => (
            <DateField
              {...fieldProps}
              value={form.startDate}
              onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          )}
        </Field>
      </div>
      <Field
        label="Classificação (sugerida)"
        required={false}
        className="w-fit"
        help="Sugerida a partir do nome — pode ser ajustada."
        labelExtra={<ClassificationFieldHelp />}
      >
        {(fieldProps) => (
          <SegmentedControl
            {...fieldProps}
            aria-label="Classificação (sugerida)"
            options={CLASSIFICATION_OPTIONS}
            value={form.classification}
            onValueChange={(classification) => {
              setClassificationTouched(true)
              setForm((prev) => ({ ...prev, classification }))
            }}
          />
        )}
      </Field>
      {(error ?? create.isError) ? (
        <p role="alert" className="text-style-body-sm text-ink-negative">
          {error ?? errorMessage(create.error)}
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <RequiredFieldLegend />
        <div className="flex items-center gap-8">
          {onCancel ? (
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? 'Salvando…' : '+ Adicionar'}
          </Button>
        </div>
      </div>
    </form>
  )
}

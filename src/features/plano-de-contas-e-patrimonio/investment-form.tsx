'use client'

/**
 * O formulário COMPLETO de cadastro de investimento — Figma 333:110 (Nome,
 * Entidade, Valor inicial acumulado, "+ Adicionar").
 *
 * Vive aqui, e não dentro de `screens/investimentos.tsx`, porque o Wireframe
 * pede que ele seja reaproveitado: a nota 103:37 do frame 103:21 ("Estado —
 * Adicionar Direcionamento (Investimento)") diz, palavra por palavra, que o
 * "+ Adicionar" do destino "Abre o formulário completo de cadastro de
 * investimento já existente no produto". Um formulário reduzido inventado no
 * modal de venda seria justamente o que essa nota proíbe.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { ZERO, type Cents } from '@/domain/core'
import { ApiError } from '@/lib/api-client'
import { investments } from './investments'
import type { Investment } from './types'

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

interface FormState {
  name: string
  entity: 'PF' | 'PJ'
  accumulatedValue: Cents
}

const EMPTY_FORM: FormState = { name: '', entity: 'PF', accumulatedValue: ZERO }

// Tailwind só enxerga classe literal: o mapa existe para que `grid-cols-2` e
// `grid-cols-3` cheguem ao CSS gerado.
const GRID_COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3' } as const

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível salvar. Tente novamente.'
}

export function InvestmentForm({
  columns = 3,
  onCreated,
  onCancel,
}: {
  /** 3 na tela Investimentos (Figma 333:110); 2 dentro do modal de venda. */
  columns?: 2 | 3
  onCreated?: (created: Investment) => void
  onCancel?: () => void
}) {
  const create = investments.useCreate()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [nameError, setNameError] = React.useState<string | undefined>(undefined)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    if (name === '') {
      setNameError('Informe o nome do investimento.')
      return
    }
    setNameError(undefined)
    create.mutate(
      { name, entity: form.entity, accumulatedValue: form.accumulatedValue },
      {
        onSuccess: (created) => {
          setForm(EMPTY_FORM)
          onCreated?.(created)
        },
      },
    )
  }

  return (
    <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
      {/* Figma 333:110: Nome, Entidade e Valor inicial acumulado são uma
          única linha (x=0/443/599), nessa ordem. */}
      <div className={`grid gap-16 ${GRID_COLUMNS[columns]}`}>
        <Field label="Nome" error={nameError}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ex: Tesouro Direto"
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
        <Field label="Valor inicial acumulado">
          {(fieldProps) => (
            <MoneyInput
              {...fieldProps}
              value={form.accumulatedValue}
              onValueChange={(accumulatedValue) =>
                setForm((prev) => ({ ...prev, accumulatedValue }))
              }
            />
          )}
        </Field>
      </div>
      {create.isError ? (
        <p role="alert" className="text-style-body-sm text-ink-negative">
          {errorMessage(create.error)}
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

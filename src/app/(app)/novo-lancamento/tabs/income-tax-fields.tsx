'use client'

import * as React from 'react'

import { ZERO, type Cents, type Entity, type IncomeTaxDirection } from '@/domain/core'
import { Field } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { DateField } from '@/components/patterns/date-field'
import { FieldSection } from '@/components/patterns/field-section'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  RecurrenceFields,
  RECURRENCE_OFF,
  type RecurrenceFormValue,
} from '@/components/patterns/recurrence-fields'
import type { BankAccount } from '@/features/novo-lancamento/types'

export interface IncomeTaxFormState {
  readonly direction: IncomeTaxDirection
  readonly entity: Entity
  readonly amount: Cents
  readonly bankAccountId: string
  readonly date: string
  readonly label: string
  readonly recurrence: RecurrenceFormValue
}

export function defaultIncomeTaxState(today: string): IncomeTaxFormState {
  return {
    // files_design/01 §5.6 exception 3: "Tipo" is a toggle with a pre-selected
    // value — "Pagamento" is the first option, in the Figma's own order.
    direction: 'Payment',
    entity: 'PF',
    amount: ZERO,
    bankAccountId: '',
    date: today,
    label: '',
    recurrence: RECURRENCE_OFF,
  }
}

const DIRECTION_OPTIONS = [
  { value: 'Payment' as const, label: 'Pagamento' },
  { value: 'Refund' as const, label: 'Recebimento' },
]

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

export interface IncomeTaxErrors {
  bankAccountId?: string
  recurrenceEndsOn?: string
}

/**
 * Aba IR — files_design/01 §5.3. No Categoria (which is exactly why it keeps
 * Rótulo), one Conta (não dois como Pró-labore: um único lado por vez, "de
 * onde sai" ou "pra onde vai"), Recorrência rotulada "Parcelar" and — the one
 * documented default exception — "Definir data de término" starts ON.
 */
export function IncomeTaxFields({
  value,
  onChange,
  bankAccounts,
  errors,
  editingExisting = false,
  seriesSlot,
}: {
  value: IncomeTaxFormState
  onChange: (next: IncomeTaxFormState) => void
  bankAccounts: readonly BankAccount[]
  errors: IncomeTaxErrors
  /** See `ExpenseRevenueFields` — the PATCH route never touches Recorrência. */
  editingExisting?: boolean
  /**
   * Editing one month of a série (2026-10-01): replaces the Recorrência note
   * with the "Aplicar esta mudança a" choice, hides Status (the month is a
   * Previsto) and locks the Data (an occurrence's date is the series').
   */
  seriesSlot?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-20">
      <p className="text-style-body-sm text-ink-secondary">
        IR: registro do Imposto de Renda pago ou recebido (restituição). Não calcula o imposto, só
        registra o valor que você já apurou.
      </p>

      <FieldSection title="Informações Básicas" first>
        <Field label="Tipo" required={false}>
          {({ id, 'aria-describedby': describedBy }) => (
            <SegmentedControl
              id={id}
              aria-describedby={describedBy}
              value={value.direction}
              onValueChange={(direction) => onChange({ ...value, direction })}
              options={DIRECTION_OPTIONS}
            />
          )}
        </Field>

        <Field label="Entidade" required={false}>
          {({ id, 'aria-describedby': describedBy }) => (
            <SegmentedControl
              id={id}
              aria-describedby={describedBy}
              value={value.entity}
              onValueChange={(entity) => onChange({ ...value, entity })}
              options={ENTITY_OPTIONS}
            />
          )}
        </Field>

        <Field label="Valor">
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={value.amount}
              onValueChange={(amount) => onChange({ ...value, amount })}
            />
          )}
        </Field>

        <Field label="Conta" error={errors.bankAccountId}>
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <Select
              value={value.bankAccountId}
              onValueChange={(bankAccountId) => onChange({ ...value, bankAccountId })}
            >
              <SelectTrigger
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="Selecionar conta…"
              />
              <SelectContent>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field label="Data">
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <DateField
              disabled={seriesSlot !== undefined}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={value.date}
              onChange={(event) => onChange({ ...value, date: event.target.value })}
            />
          )}
        </Field>

        {/* "Rótulo (opcional)" is the label the frame draws, word for word
            (Figma `68:4`, and files_design/01 §5.3) — the parenthetical is
            part of the label, not a substitute for the missing asterisk. */}
        <Field label="Rótulo (opcional)" required={false}>
          {({ id, 'aria-describedby': describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              placeholder="Ex: IR referente a 2025"
              value={value.label}
              onChange={(event) => onChange({ ...value, label: event.target.value })}
            />
          )}
        </Field>
      </FieldSection>

      <FieldSection title="Recorrência">
        {seriesSlot !== undefined ? (
          seriesSlot
        ) : editingExisting ? (
          <p className="text-style-body-sm text-ink-secondary">
            Recorrência não é editada por aqui — use a tela Revisão de Recorrentes.
          </p>
        ) : (
          <>
            <RecurrenceFields
              idPrefix="recurrence-ir"
              value={value.recurrence}
              onChange={(recurrence) => onChange({ ...value, recurrence })}
              toggleLabel="Parcelar (repete todo mês)"
              // files_design/03 "Aba IR": the one tab where the end-date toggle
              // starts ON — a screen default, not the shared server default.
              endsOnDefaultWhenActivated=""
            />
            {errors.recurrenceEndsOn ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {errors.recurrenceEndsOn}
              </p>
            ) : null}
          </>
        )}
      </FieldSection>

      {/* Figma `55:189`: a titled note, "Orientação" on its own line above the
          sentence — transcribed word for word, capital "Lance" included. */}
      <div className="flex flex-col gap-4 rounded-control bg-surface-subtle p-12">
        <p className="text-style-body-sm font-medium text-ink-primary">Orientação</p>
        <p className="text-style-body-sm text-ink-secondary">
          Lance o IR pago ou restituído no mês em que o valor efetivamente saiu ou entrou na conta,
          não no mês de referência do imposto.
        </p>
      </div>
    </div>
  )
}

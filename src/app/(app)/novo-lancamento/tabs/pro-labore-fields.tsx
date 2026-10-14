'use client'

import * as React from 'react'

import { LABEL_STATUS, ZERO, type Cents, type EntryStatus } from '@/domain/core'
import { Field } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { DateField } from '@/components/patterns/date-field'
import { FieldSection } from '@/components/patterns/field-section'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { InfoTooltip } from '@/components/patterns/info-tooltip'
import { StatusFieldHelp } from '@/components/patterns/field-help'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  RecurrenceFields,
  RECURRENCE_OFF,
  type RecurrenceFormValue,
} from '@/components/patterns/recurrence-fields'
import type { BankAccount } from '@/features/novo-lancamento/types'

export const PRO_LABORE_SUB_KINDS = ['ProLabore', 'ProfitDistribution'] as const
export type ProLaboreSubKind = (typeof PRO_LABORE_SUB_KINDS)[number]

export interface ProLaboreFormState {
  readonly subKind: ProLaboreSubKind
  readonly amount: Cents
  readonly date: string
  /**
   * Pedido de produto, 2026-09-23: a aba não tinha Status e todo pró-labore
   * nascia Pago — um pró-labore a receber em outubro não tinha como ser
   * Previsto. Mesmo controle da Despesa, mesmo padrão (Pago).
   */
  readonly status: EntryStatus
  readonly sourceAccountId: string
  readonly destinationAccountId: string
  readonly recurrence: RecurrenceFormValue
}

export function defaultProLaboreState(today: string): ProLaboreFormState {
  return {
    // files_design/03: "Sub-tipo... default: vazio", but files_design/01 §5.6
    // lists Sub-tipo among the toggles that "nunca ficam vazios de qualquer
    // forma" — same resolved contradiction as Entidade (P20). "Pró-labore" is
    // the first option, in the Figma's own segment order.
    subKind: 'ProLabore',
    amount: ZERO,
    date: today,
    // Previsto by default, like Despesa and Receita (owner's request, 2026-10-01).
    status: 'Planned',
    sourceAccountId: '',
    destinationAccountId: '',
    recurrence: RECURRENCE_OFF,
  }
}

const SUB_KIND_OPTIONS = [
  { value: 'ProLabore' as const, label: 'Pró-labore' },
  { value: 'ProfitDistribution' as const, label: 'Distribuição de lucro' },
]

/**
 * ADR-0018: a origem é opcional, e o Select do Radix não aceita item de valor
 * vazio — então "Sem conta de origem" é um item com este valor, que o envio
 * traduz para `null`. Serve também de lista não vazia para quem não tem conta
 * PJ cadastrada: antes, a lista abria como uma barra sem nenhum item.
 */
export const NO_SOURCE_ACCOUNT = '__sem-conta-de-origem__'

export interface ProLaboreErrors {
  destinationAccountId?: string
  recurrenceEndsOn?: string
}

/**
 * Aba Pró-labore e Distribuição — files_design/01 §5.2. No Entidade field: the
 * intercompany engine derives PF/PJ/consolidated from the kind
 * (`src/domain/entries/projection.ts`). Conta de origem is filtered to PJ and
 * is optional (ADR-0018); Conta de destino is filtered to PF and required.
 */
export function ProLaboreFields({
  value,
  onChange,
  pjAccounts,
  pfAccounts,
  errors,
  editingExisting = false,
  seriesSlot,
}: {
  value: ProLaboreFormState
  onChange: (next: ProLaboreFormState) => void
  pjAccounts: readonly BankAccount[]
  pfAccounts: readonly BankAccount[]
  errors: ProLaboreErrors
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
        Pró-labore e Distribuição: transferência de dinheiro da PJ pra PF. Pró-labore reduz o lucro
        da PJ (é remuneração pelo trabalho); Distribuição de lucro só divide o que já sobrou, sem
        afetar o resultado.
      </p>

      <FieldSection title="Informações Básicas" first>
        <Field
          label="Sub-tipo"
          required={false}
          labelExtra={
            <InfoTooltip label="Ajuda sobre Sub-tipo" width="wide">
              <p>
                Pró-labore: remuneração pelo seu trabalho, reduz o lucro da PJ e vira receita na PF.
              </p>
              <p className="mt-8">
                Distribuição de lucro: direciona a parte do lucro que sobra, não afeta o resultado
                da PJ.
              </p>
            </InfoTooltip>
          }
        >
          {({ id, 'aria-describedby': describedBy }) => (
            <SegmentedControl
              id={id}
              aria-describedby={describedBy}
              value={value.subKind}
              onValueChange={(subKind) => onChange({ ...value, subKind })}
              options={SUB_KIND_OPTIONS}
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
        {seriesSlot === undefined ? (
          <Field
            label="Status"
            required={false}
            labelExtra={<StatusFieldHelp paidLabel={LABEL_STATUS[value.subKind].Paid} />}
          >
            {({ id, 'aria-describedby': describedBy }) => (
              <SegmentedControl
                id={id}
                aria-describedby={describedBy}
                value={value.status}
                onValueChange={(status) => onChange({ ...value, status })}
                options={[
                  { value: 'Planned' as const, label: LABEL_STATUS[value.subKind].Planned },
                  { value: 'Paid' as const, label: LABEL_STATUS[value.subKind].Paid },
                ]}
              />
            )}
          </Field>
        ) : null}
      </FieldSection>

      <FieldSection title="Transferência">
        {/* Figma `222:2`: the two accounts sit SIDE BY SIDE, splitting the
            form column in half — they are the two ends of ONE transfer, and
            stacking them reads as two unrelated fields. */}
        <div className="grid grid-cols-2 gap-8">
          <Field
            label="Conta de origem (PJ)"
            required={false}
            labelExtra={
              <InfoTooltip label="Ajuda sobre Conta de origem" width="wide">
                <p>
                  Opcional. Use quando o dinheiro sai de uma conta PJ cadastrada aqui. Se a conta PJ
                  não está no app, deixe em branco: o lançamento continua contando no DRE da PF e da
                  PJ.
                </p>
              </InfoTooltip>
            }
          >
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
              <Select
                value={value.sourceAccountId}
                onValueChange={(sourceAccountId) => onChange({ ...value, sourceAccountId })}
              >
                <SelectTrigger
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="Selecionar conta…"
                />
                <SelectContent>
                  <SelectItem value={NO_SOURCE_ACCOUNT}>Sem conta de origem</SelectItem>
                  {pjAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Conta de destino (PF)" error={errors.destinationAccountId}>
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
              <Select
                value={value.destinationAccountId}
                onValueChange={(destinationAccountId) =>
                  onChange({ ...value, destinationAccountId })
                }
              >
                <SelectTrigger
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="Selecionar conta…"
                />
                <SelectContent>
                  {pfAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>

        <p className="text-style-body-sm text-ink-secondary">
          Sem campo de entidade: afeta PF e PJ ao mesmo tempo, automaticamente, e é eliminado no
          consolidado.
        </p>
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
              idPrefix="recurrence-prolabore"
              value={value.recurrence}
              onChange={(recurrence) => onChange({ ...value, recurrence })}
              toggleLabel="Este lançamento se repete todo mês"
            />
            {errors.recurrenceEndsOn ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {errors.recurrenceEndsOn}
              </p>
            ) : null}
          </>
        )}
      </FieldSection>
    </div>
  )
}

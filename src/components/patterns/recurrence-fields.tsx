'use client'

import * as React from 'react'
import { RECURRENCE_AMOUNT_KINDS, type RecurrenceAmountKind } from '@/domain/core'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { DateField } from '@/components/patterns/date-field'
import { InfoTooltip } from '@/components/patterns/info-tooltip'
import { Field } from '@/components/ui/field'

/** The Recorrência form state — `null` end date means "indefinida" (files_design/03). */
export interface RecurrenceFormValue {
  readonly active: boolean
  readonly amountKind: RecurrenceAmountKind
  readonly endsOn: string | null
}

export const RECURRENCE_OFF: RecurrenceFormValue = {
  active: false,
  amountKind: 'Fixed',
  endsOn: null,
}

const AMOUNT_KIND_OPTIONS = RECURRENCE_AMOUNT_KINDS.map((kind) => ({
  value: kind,
  label: kind === 'Fixed' ? 'Fixo (copia o valor)' : 'A definir (em branco)',
}))

/**
 * Recorrência — files_design/01 §5.4: "Toggle liga/desliga · Tipo de valor
 * (fixo/a definir) · Término (data ou indefinida)". The block is always
 * VISIBLE (files_design/01 §5: "campo visível por padrão"), but the two inner
 * fields only appear once the toggle is on (files_design/02, frame `81:38`,
 * state "⓪ Recorrência desligada: nada disso aparece").
 *
 * `toggleLabel` differs per tab word for word (Despesa: "Este lançamento se
 * repete todo mês" · Receita: "Esta receita se repete todo mês" · IR: rotulada
 * "Parcelar" — files_design/03 "Aba IR").
 */
export function RecurrenceFields({
  value,
  onChange,
  toggleLabel,
  idPrefix,
  endsOnDefaultWhenActivated = null,
}: {
  value: RecurrenceFormValue
  onChange: (next: RecurrenceFormValue) => void
  toggleLabel: string
  idPrefix: string
  /**
   * What "Definir data de término" starts as the MOMENT the person turns the
   * whole block on. `null` (every tab but IR) means the sub-toggle starts off.
   * IR passes `''` (files_design/03 "Aba IR": "o toggle 'Definir data de
   * término' vem ligado por padrão... diferente de Despesa/Receita/
   * Pró-labore, onde vem desligado") — a screen default, never a server one.
   */
  endsOnDefaultWhenActivated?: string | null
}) {
  const hasEndDate = value.endsOn !== null

  return (
    <div className="flex flex-col gap-16">
      <div className="flex items-center justify-between gap-16">
        <label htmlFor={`${idPrefix}-active`} className="text-style-body-md text-ink-primary">
          {toggleLabel}
        </label>
        <Switch
          id={`${idPrefix}-active`}
          checked={value.active}
          onCheckedChange={(active) =>
            onChange(
              active
                ? { ...value, active, endsOn: endsOnDefaultWhenActivated }
                : { ...RECURRENCE_OFF },
            )
          }
        />
      </div>

      {value.active ? (
        <>
          <Field
            label="Tipo de valor"
            required={false}
            className="gap-8"
            labelExtra={
              <InfoTooltip label="Ajuda sobre Tipo de valor" width="wide">
                <p>Fixo: o valor se repete igualmente todo mês.</p>
                <p className="mt-8">
                  A definir: o valor sofre alterações e deve ser informado a cada mês.
                </p>
                <p className="mt-8">
                  Para editar ou informar o valor de recorrências, use a tela Revisão de
                  Recorrentes.
                </p>
              </InfoTooltip>
            }
          >
            {({ id, 'aria-describedby': describedBy }) => (
              <SegmentedControl
                id={id}
                aria-describedby={describedBy}
                value={value.amountKind}
                onValueChange={(amountKind) => onChange({ ...value, amountKind })}
                options={AMOUNT_KIND_OPTIONS}
              />
            )}
          </Field>

          <div className="flex flex-col gap-8">
            <span className="text-style-body-sm text-ink-secondary">
              Término (data da última ocorrência)
            </span>
            <div className="flex items-center justify-between gap-16">
              <label
                htmlFor={`${idPrefix}-has-end`}
                className="text-style-body-md text-ink-primary"
              >
                Definir data de término
              </label>
              <Switch
                id={`${idPrefix}-has-end`}
                checked={hasEndDate}
                onCheckedChange={(checked) => onChange({ ...value, endsOn: checked ? '' : null })}
              />
            </div>
            {hasEndDate ? (
              <DateField
                aria-label="Término (data da última ocorrência)"
                value={value.endsOn ?? ''}
                onChange={(event) => onChange({ ...value, endsOn: event.target.value })}
              />
            ) : (
              <p className="text-style-body-sm text-ink-secondary">
                Recorrência repete indefinidamente, sem precisar escolher data.
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

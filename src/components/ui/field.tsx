'use client'

import * as React from 'react'
import { Label } from './input'
import { cn } from '@/lib/cn'

/**
 * Field — ties label, control, help text and error together with the right
 * `id` / `aria-*` wiring.
 *
 * It exists because the product has long forms (the Despesa tab has eight
 * fields) and wiring `<label htmlFor>` + `aria-describedby` + `aria-invalid` by
 * hand, field by field, is exactly where accessibility is lost in practice.
 * Here it is structural.
 *
 * Required-ness follows files_design/03: required is the DEFAULT, with three
 * documented exceptions. Hence `required` defaults to `true` — the easy path is
 * the correct one, and the exception has to be written out deliberately.
 */
export interface FieldProps {
  label: string
  /** `false` only in the three exceptions: Rótulo, allocation fields, and toggles with a default. */
  required?: boolean
  /**
   * Rendered right after the label text, on the same line — the discreet "i"
   * help tooltip that Status, Classificação, Tipo de valor and Sub-tipo carry
   * (Figma `71:11`). Optional: most fields have no such icon.
   */
  labelExtra?: React.ReactNode
  help?: string
  error?: string
  className?: string
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean | undefined
    'aria-required': boolean | undefined
  }) => React.ReactNode
}

export function Field({
  label,
  required = true,
  labelExtra,
  help,
  error,
  className,
  children,
}: FieldProps) {
  const id = React.useId()
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-8">
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        {labelExtra}
      </div>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {help ? (
        <p id={helpId} className="text-style-body-sm text-ink-secondary">
          {help}
        </p>
      ) : null}
      {/* `role="alert"` so the error reaches a screen reader when it appears
          after submission, without having to move focus. Red text pairs with
          the field's own `border-line-negative` — files_design/07's one
          documented exception to "red only means negative variation". */}
      {error ? (
        <p id={errorId} role="alert" className="text-style-body-sm text-ink-negative">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** The global legend required by files_design/03, at the foot of every form. */
export function RequiredFieldLegend({ className }: { className?: string }) {
  return (
    <p className={cn('text-style-body-sm text-ink-secondary', className)}>
      <span aria-hidden="true">* </span>
      Campo obrigatório
    </p>
  )
}

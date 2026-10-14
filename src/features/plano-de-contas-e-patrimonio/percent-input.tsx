'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'

/**
 * A monthly interest rate field — files_design/03 "Passivos": "Taxa de juros
 * (a.m.) | numérico (percentual)". The wire and the domain both carry a
 * decimal fraction (`monthlyRateSchema`, 0.0085 = 0,85% a.m.), but nobody types
 * a fraction — the person types "0,85" and reads it back the same way, so the
 * conversion happens at this one boundary, the same reasoning `MoneyInput`
 * applies to cents.
 *
 * Free text rather than `type="number"`: pt-BR uses a comma decimal separator,
 * and `<input type="number">` both rejects the comma the person types and
 * renders with the browser's OS locale, which is not always pt-BR.
 */
export function parsePercentText(text: string): number | null {
  const normalised = text.trim().replace(',', '.')
  if (normalised === '') return null
  const value = Number(normalised)
  if (!Number.isFinite(value) || value < 0) return null
  return value / 100
}

export function formatPercentText(fraction: number): string {
  const percent = fraction * 100
  // Up to 4 decimal places, trimmed — 0.85 stays "0,85", not "0,8500".
  const rounded = Math.round(percent * 10000) / 10000
  return String(rounded).replace('.', ',')
}

export const PercentInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
    value: string
    onValueChange: (text: string) => void
  }
>(function PercentInput({ value, onValueChange, ...props }, ref) {
  return (
    <Input
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder="0,00"
      {...props}
    />
  )
})

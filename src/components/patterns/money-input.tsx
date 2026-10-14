'use client'

import * as React from 'react'
import { type Cents, cents, formatMoney, ZERO } from '@/domain/core'
import { cn } from '@/lib/cn'

/**
 * MoneyInput — the active-mask money field. It is the most reused control in
 * the product (Novo Lançamento, onboarding, Vender Bem Material, Destinar o
 * Lucro, Consumo Livre), so its behaviour is specified once, here.
 *
 * The contract, from files_design/03 "campos monetários usam máscara ativa":
 *   - The field ALWAYS starts showing "R$ 0,00". That is the state of the mask,
 *     not a suggestion of the expected amount — it looks the same whether the
 *     final value is R$ 10 or R$ 500.000.
 *   - The person types digits only. Each digit enters from the RIGHT, pushing
 *     the previous digits left. So the typed digits are literally the cents.
 *   - The comma stays fixed. There is no intermediate "empty zeros waiting to be
 *     filled" state (never "R$ 000.000,00").
 *   - No pre-defined length limit; the value grows as the person types.
 *
 * Consequences that fall out of the mask and are deliberate:
 *   - Backspace removes the rightmost DIGIT, so "R$ 12,00" becomes "R$ 1,20".
 *     That is how this mask type behaves everywhere and it is what makes the
 *     "digits from the right" rule consistent in both directions.
 *   - The caret is pinned to the end. Editing in the middle of a masked number
 *     produces results no one can predict, so it is not offered.
 *
 * The value handed out is always `Cents`, so no screen ever sees a float.
 */

const MAX_CENTS = Number.MAX_SAFE_INTEGER

export interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> {
  value: Cents
  onValueChange: (value: Cents) => void
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, '')
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, className, onKeyDown, onFocus, onClick, ...props },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLInputElement>(null)
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement)

  const pinCaretToEnd = React.useCallback(() => {
    const el = innerRef.current
    if (!el) return
    const end = el.value.length
    // Only move when it is not already there, otherwise the caret fights the
    // browser's own selection handling on every keystroke.
    if (el.selectionStart !== end || el.selectionEnd !== end) {
      el.setSelectionRange(end, end)
    }
  }, [])

  React.useEffect(pinCaretToEnd, [value, pinCaretToEnd])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = digitsOf(event.target.value)
    const parsed = digits === '' ? 0 : Number(digits)
    if (!Number.isSafeInteger(parsed) || parsed > MAX_CENTS) {
      // Refuse silently rather than showing a number the person cannot verify.
      return
    }
    onValueChange(cents(parsed))
  }

  return (
    <input
      ref={innerRef}
      // `inputMode="numeric"` gives the numeric keypad on mobile without the
      // spinner and locale parsing problems of `type="number"`.
      inputMode="numeric"
      autoComplete="off"
      value={formatMoney(value)}
      onChange={handleChange}
      onKeyDown={(event) => {
        // Arrow keys and Home/End would move the caret into the middle of the
        // mask, where typing does something the person cannot predict.
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)
        ) {
          event.preventDefault()
        }
        onKeyDown?.(event)
      }}
      onFocus={(event) => {
        pinCaretToEnd()
        onFocus?.(event)
      }}
      onClick={(event) => {
        pinCaretToEnd()
        onClick?.(event)
      }}
      className={cn(
        'numeric h-[var(--height-field)] w-full rounded-control border border-line-control',
        'bg-surface-card px-12 text-style-body-md text-ink-primary',
        'disabled:pointer-events-none disabled:opacity-40',
        'aria-[invalid=true]:border-line-negative',
        className,
      )}
      {...props}
    />
  )
})

/** Convenience for uncontrolled-ish usage in prototypes and stories. */
export function useMoneyField(initial: Cents = ZERO) {
  const [value, setValue] = React.useState<Cents>(initial)
  return { value, onValueChange: setValue, reset: () => setValue(ZERO) }
}

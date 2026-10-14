'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/cn'

/** files_design/07 "Campo": rótulo acima em body.sm, cor secundária. */
export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(function Label({ className, required, children, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-style-body-sm text-ink-secondary', className)}
      {...props}
    >
      {children}
      {/* files_design/03: a required field is marked with an asterisk plus a
          legend. `aria-hidden` because the asterisk is redundant for a screen
          reader — `aria-required` on the control does that job. */}
      {required ? <span aria-hidden="true">{' *'}</span> : null}
    </LabelPrimitive.Root>
  )
})

/**
 * A "Caixa" do Campo — a geometria do controle, numa definição só.
 *
 * Medida na página Mockup, `872:1305` "Modal — Novo Lançamento": todo campo
 * daquele formulário é a MESMA `<instance name="Campo">` de 432×64 — Valor
 * (`872:1359`), Data de pagamento (`872:1363`), Categoria (`877:3`) e Conta
 * (`877:19`) — e dentro dela a caixa (`I877:19;460:5`) mede 432×40 com o texto
 * em x=12. Daí `--height-field` (40) e `px-12`.
 *
 * É uma constante exportada, e não uma classe copiada em cada controle, porque
 * o Style guide trata as quatro variantes do Campo (`460:20`: `field/default`
 * 460:3, `field/focus` 460:7, `field/error` 460:11, `field/disabled` 460:16)
 * como um componente único. Enquanto o `SelectTrigger` reescrevia essa
 * geometria por conta própria, ele não herdava nenhuma delas.
 */
export const fieldControlClassName = cn(
  'h-[var(--height-field)] w-full rounded-control border border-line-control',
  'bg-surface-card px-12 text-style-body-md text-ink-primary',
  'placeholder:text-ink-tertiary',
  'disabled:pointer-events-none disabled:opacity-40',
  'aria-[invalid=true]:border-line-negative',
)

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldControlClassName, className)} {...props} />
})

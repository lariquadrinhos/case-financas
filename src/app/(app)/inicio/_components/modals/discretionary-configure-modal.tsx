'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { ZERO, type Cents, type Entity } from '@/domain/core'
import { useBankAccounts, type DiscretionarySpendingConfig } from '../../_lib/queries'
import { useSaveDiscretionarySpendingConfig } from '../../_lib/mutations'

/**
 * Configurar Consumo Livre — Estado A, modal sobre Início, docs/figma/frames/
 * 345-502__desktop-configurar-consumo-livre-modal-sobre-inicio.xml, node
 * 192:2. Também reaberto por "Editar valor e conta" no Estado C
 * (files_design/01 §4a) — mesmos dois campos, mesmo `PUT` idempotente
 * (`discretionarySpendingConfigPutSchema`, um upsert nos dois casos).
 */
export function DiscretionaryConfigureModal({
  open,
  onOpenChange,
  current,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` na primeira vez (Estado A); preenchido quando reaberto por "Editar valor e conta". */
  current: DiscretionarySpendingConfig | null | undefined
}) {
  const bankAccounts = useBankAccounts()
  const save = useSaveDiscretionarySpendingConfig()

  const [monthlyAmount, setMonthlyAmount] = React.useState<Cents>(ZERO)
  const [sourceAccountId, setSourceAccountId] = React.useState('')
  const [entity, setEntity] = React.useState<Entity>('PF')
  // Verba (2026-09-29): um valor fixo por mês, ou o saldo da conta de origem.
  const [allowanceKind, setAllowanceKind] = React.useState<'Fixed' | 'SourceBalance'>('Fixed')

  React.useEffect(() => {
    if (!open) return
    setMonthlyAmount((current?.monthlyAmount as Cents | undefined) ?? ZERO)
    setSourceAccountId(current?.sourceAccountId ?? '')
    setEntity(current?.entity ?? 'PF')
    setAllowanceKind(current?.allowanceKind ?? 'Fixed')
  }, [open, current])

  const canSubmit =
    sourceAccountId !== '' && (allowanceKind === 'SourceBalance' || monthlyAmount > 0)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    save.mutate(
      {
        // Com a verba = saldo da conta, o valor mensal não é usado.
        monthlyAmount: allowanceKind === 'SourceBalance' ? ZERO : monthlyAmount,
        sourceAccountId,
        entity,
        allowanceKind,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 380 de largura: frame 192:2 (Wireframe) e nó "Diálogo" 1000:2886 (Mockup). */}
      <DialogContent width="compact" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Configurar Consumo Livre</DialogTitle>
          <DialogDescription>
            Escolha a conta do Consumo Livre e a verba: um valor fixo por mês ou o saldo da própria
            conta. Toda saída dessa conta que vem do banco cai aqui, exceto o cartão de crédito.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form className="flex flex-col gap-20" onSubmit={handleSubmit}>
            <Field label="Verba" required={false}>
              {(fieldProps) => (
                <SegmentedControl
                  {...fieldProps}
                  aria-label="Verba"
                  options={[
                    { value: 'Fixed' as const, label: 'Valor fixo' },
                    { value: 'SourceBalance' as const, label: 'Saldo da conta' },
                  ]}
                  value={allowanceKind}
                  onValueChange={setAllowanceKind}
                />
              )}
            </Field>
            {allowanceKind === 'Fixed' ? (
              <Field label="Valor mensal">
                {({ id, ...aria }) => (
                  <MoneyInput
                    id={id}
                    value={monthlyAmount}
                    onValueChange={setMonthlyAmount}
                    {...aria}
                  />
                )}
              </Field>
            ) : (
              <p className="text-style-body-sm text-ink-secondary">
                O limite do mês é o que está na conta de origem: o card mostra quanto já saiu e o
                saldo que resta.
              </p>
            )}
            <Field label="Conta de origem">
              {({ id, ...aria }) => (
                <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                  <SelectTrigger id={id} {...aria} />
                  <SelectContent>
                    {(bankAccounts.data?.data ?? []).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Button type="submit" width="full" disabled={!canSubmit || save.isPending}>
              Salvar
            </Button>
            <RequiredFieldLegend />
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

'use client'

/**
 * "Direcionar agora" na Pendência de sobra do Consumo Livre — P14 (produto,
 * 2026-09-08).
 *
 * **Desenhado na Mockup em 2026-09-11**: `Desktop — Direcionar Sobra (claro)` e
 * `(escuro)`, diálogo de 440 (`--width-dialog-allocation`). Até então esta era
 * a ÚNICA tela do produto que existia em código sem frame nenhum — nasceu de
 * uma decisão de produto (P14) tomada depois do corpo de design, e ninguém
 * voltou para desenhá-la. Ela só apareceu porque compartilhava um token de
 * grade com dois diálogos irmãos; sem esse acaso, teria ficado de fora do
 * ajuste de largura dos campos de valor sem ninguém notar.
 *
 * Reusa a anatomia do formulário que o Figma já desenhava para ESTE dinheiro:
 * "Redirecionar saldo restante", no Detalhe do Consumo Livre (`345:752`, campos
 * `192:38` "Para onde" e `192:44` "Valor"). É o mesmo par destino + valor, com
 * o mesmo `SearchCreateField` e o mesmo `MoneyInput` — nada de controle novo.
 *
 * O que muda em relação àquele formulário: o destino ganha **Consumo Livre
 * deste mês**, que é a razão de a Pendência existir (a sobra volta a ser
 * gastável só se a pessoa mandar). O placeholder desenhado passou a dizer
 * "Buscar conta, investimento, dívida ou Consumo Livre…" nos três frames.
 *
 * Direcionar parte é permitido: a Pendência fica com o resto, igual à de venda
 * de bem material (P14, pergunta 3).
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { formatMoney, formatMonthName, type Cents, type Month } from '@/domain/core'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { SearchCreateField, type SearchCreateItem } from '@/components/patterns/search-create-field'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Dialog,
} from '@/components/ui/dialog'
import { ApiError, apiPost } from '@/lib/api-client'

import { useBankAccounts, useInvestments, useLiabilities } from '../../_lib/queries'

export interface SobraSelection {
  readonly month: Month
  readonly remaining: Cents
}

/** O destino que devolve a sobra à verba — não é conta, investimento nem dívida. */
const DISCRETIONARY_ITEM: SearchCreateItem = {
  id: '__discretionary__',
  label: 'Consumo Livre deste mês',
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível direcionar agora. Tente novamente.'
}

export function DirecionarSobraModal({
  selection,
  open,
  onOpenChange,
}: {
  selection: SobraSelection | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="allocation">
        {selection ? (
          <Body key={selection.month} selection={selection} onOpenChange={onOpenChange} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  selection,
  onOpenChange,
}: {
  selection: SobraSelection
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const bankAccounts = useBankAccounts()
  const investments = useInvestments()
  const liabilities = useLiabilities()

  const [query, setQuery] = React.useState('')
  const [target, setTarget] = React.useState<SearchCreateItem | null>(null)
  const [amount, setAmount] = React.useState<Cents>(selection.remaining)
  const [error, setError] = React.useState<string | null>(null)

  const items: readonly (SearchCreateItem & {
    kind: 'Discretionary' | 'BankAccount' | 'Investment' | 'Liability'
  })[] = React.useMemo(() => {
    const all = [
      { ...DISCRETIONARY_ITEM, kind: 'Discretionary' as const },
      ...(bankAccounts.data?.data ?? []).map((a) => ({
        id: a.id,
        label: a.label,
        kind: 'BankAccount' as const,
      })),
      ...(investments.data?.data ?? []).map((i) => ({
        id: i.id,
        label: i.name,
        kind: 'Investment' as const,
      })),
      ...(liabilities.data?.data ?? []).map((l) => ({
        id: l.id,
        label: l.name,
        kind: 'Liability' as const,
      })),
    ]
    const term = query.trim().toLowerCase()
    return term === '' ? all : all.filter((item) => item.label.toLowerCase().includes(term))
  }, [bankAccounts.data, investments.data, liabilities.data, query])

  const direct = useMutation({
    mutationFn: (body: unknown) => apiPost('/leftover-directions', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-items'] })
      void queryClient.invalidateQueries({ queryKey: ['discretionary-spending'] })
      onOpenChange(false)
    },
    onError: (e) => setError(errorMessage(e)),
  })

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const escolhido = items.find((item) => item.id === target?.id)
    if (!escolhido || amount <= 0) return
    if (amount > selection.remaining) {
      setError('O valor não pode ser maior do que a sobra ainda sem destino.')
      return
    }
    const destination =
      escolhido.kind === 'Discretionary'
        ? { kind: 'Discretionary' }
        : escolhido.kind === 'BankAccount'
          ? { kind: 'BankAccount', bankAccountId: escolhido.id }
          : escolhido.kind === 'Investment'
            ? { kind: 'Investment', investmentId: escolhido.id }
            : { kind: 'Liability', liabilityId: escolhido.id }
    direct.mutate({ month: selection.month, amount, destination })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Direcionar valor</DialogTitle>
        <DialogDescription>
          {formatMoney(selection.remaining)} de sobra do Consumo Livre de{' '}
          {formatMonthName(selection.month)}. Pode direcionar em partes: o que restar continua
          pendente.
        </DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-16">
          <Field label="Para onde">
            {({ id, ...aria }) => (
              <SearchCreateField
                id={id}
                {...aria}
                items={items}
                query={target?.label ?? query}
                onQueryChange={(next) => {
                  setQuery(next)
                  setTarget(null)
                }}
                onSelect={(item) => {
                  setTarget(item)
                  setQuery(item.label)
                }}
                placeholder="Buscar conta, investimento, dívida ou Consumo Livre…"
              />
            )}
          </Field>
          {/* 180: o mínimo para "R$ 999.000.000.000,00" (154 de texto medido no
              navegador + 12 + 12 de respiro + borda) — sem folga nenhuma.
              Ver `--width-field-money-dialog`. */}
          <Field label="Valor" className="w-[var(--width-field-money-dialog)]">
            {({ id, ...aria }) => (
              <MoneyInput id={id} value={amount} onValueChange={setAmount} {...aria} />
            )}
          </Field>
        </div>
        {error ? (
          <p role="alert" className="text-style-body-sm text-ink-negative">
            {error}
          </p>
        ) : null}
        <Button type="submit" width="full" disabled={!target || amount <= 0 || direct.isPending}>
          Direcionar
        </Button>
        {/* files_design/03: uma vez por tela ou diálogo com campo obrigatório,
            no fim. Os dois campos daqui são obrigatórios. */}
        <RequiredFieldLegend />
      </form>
    </>
  )
}

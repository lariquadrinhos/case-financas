'use client'

/**
 * "Caixa do mês" (dono, 2026-10-09: "o DRE não está contabilizando meu saldo
 * em conta atual… poderia estar separado por banco para eu ocultar"). Abaixo da
 * cascata e fora dela: o DRE é resultado, o saldo é patrimônio (PRD §5). A
 * conta é `cashForecast` (src/domain/reports). Só no mês atual — o saldo de
 * hoje não diz nada de um mês passado ou futuro. O olhinho vale enquanto a
 * tela está aberta, como o da cascata. NÃO ESTÁ NO FIGMA.
 */

import * as React from 'react'
import { asId, cents, formatMoney, type BankAccountId, type Cents, type View } from '@/domain/core'
import { useQuery } from '@tanstack/react-query'
import { cashBridge, cashForecast, type IncomeStatementRow } from '@/domain/reports'
import { fetchIncomeStatement } from '@/lib/reports-client'
import { useMonthMovement } from '@/features/open-finance/use-month-movement'
import { useBankAccounts } from '@/features/novo-lancamento/use-novo-lancamento'
import { HideToggle } from '@/components/patterns/hide-toggle'
import { Card, CardBody, CardCaption, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'

export function DreCashCard({
  view,
  month,
  rows,
}: {
  view: View
  month: string
  rows: readonly IncomeStatementRow[]
}) {
  const bankAccounts = useBankAccounts()
  const movement = useMonthMovement(month)
  // A ponte vai até o fim do mês: o lucro dela é a previsão completa (Pago +
  // Previsto, v7.71) desta visão, sem filtro e sem olhinho — a mesma chave do
  // DRE em Previsto, então o cache é o mesmo quando a cascata já está lá.
  const forecastStatement = useQuery({
    queryKey: ['income-statement', view, month, 'Planned', '', false, false] as const,
    queryFn: () =>
      fetchIncomeStatement({
        view,
        month,
        statusFilter: 'Planned',
        recurring: 'false',
        creditCard: 'false',
      }),
  })
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set())
  const forecast = cashForecast({
    accounts: (bankAccounts.data?.data ?? []).map((a) => ({
      id: asId<BankAccountId>(a.id),
      label: a.label,
      entity: a.entity,
      balance: cents(a.balance),
    })),
    view,
    rows,
    hidden,
  })
  if (forecast.accounts.length === 0) return null
  const bridge =
    movement.status === 'success' && forecastStatement.status === 'success'
      ? cashBridge(forecast, {
          monthMovement: new Map(
            movement.data.data.map((m) => [m.bankAccountId, cents(m.movement)]),
          ),
          netProfit: forecastStatement.data.netProfit,
        })
      : null

  const toggle = (id: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Card data-dre-cash-card>
      <CardHeader>
        <CardTitle level={2}>Caixa do mês</CardTitle>
        <CardCaption>
          O saldo das contas hoje e o que ainda está previsto até o fim do mês. Fica fora da
          cascata: o DRE é resultado, o saldo é patrimônio.
        </CardCaption>
      </CardHeader>
      <CardBody className="flex flex-col pt-0">
        {forecast.accounts.map((account) => (
          <CashLine
            key={account.id}
            label={account.label}
            amount={account.balance}
            muted={account.hidden}
            toggle={<HideToggle hidden={account.hidden} onToggle={() => toggle(account.id)} />}
          />
        ))}
        <CashLine label="Saldo hoje" amount={forecast.balanceToday} separated />
        <CashLine label="Ainda previsto" amount={forecast.stillPlanned} operator="(+)" />
        <CashLine
          label="Saldo previsto no fim do mês"
          amount={forecast.endOfMonth}
          operator="(=)"
          strong
        />

        {/* Do início ao fim do mês (dono, 2026-10-09: "queria ver o Lucro
            Líquido + o caixa do mês"). Somar o lucro ao saldo de hoje contaria
            o que já foi pago duas vezes; a ponte parte do dia 1º. */}
        <h3 className="pt-20 text-style-label-xs uppercase text-ink-secondary">
          Do início ao fim do mês
        </h3>
        {bridge === null ? (
          <p className="py-8 text-style-body-sm text-ink-secondary">
            {movement.status === 'error'
              ? 'Não foi possível ler o extrato do mês agora; a ponte volta quando o banco responder.'
              : 'Lendo o extrato do mês…'}
          </p>
        ) : (
          <>
            <CashLine label="Saldo no início do mês" amount={bridge.balanceAtStart} />
            <CashLine
              label="Lucro Líquido do mês"
              amount={bridge.netProfit}
              operator="(+)"
              hint="Previsão completa: o pago mais o previsto."
            />
            <CashLine
              label="Fora do DRE"
              amount={bridge.outsideResult}
              operator="(±)"
              hint="O que mexeu no caixa e não é resultado: transferências, aportes, fatura do cartão, saldo editado à mão."
            />
            <CashLine
              label="Saldo previsto no fim do mês"
              amount={bridge.endOfMonth}
              operator="(=)"
              strong
              separated
            />
          </>
        )}
      </CardBody>
    </Card>
  )
}

function CashLine({
  label,
  amount,
  operator,
  toggle,
  hint,
  muted = false,
  strong = false,
  separated = false,
}: {
  label: string
  amount: Cents
  operator?: string
  toggle?: React.ReactNode
  /** Explicação curta, na dica da linha. */
  hint?: string
  muted?: boolean
  strong?: boolean
  separated?: boolean
}) {
  return (
    <div
      data-cash-line
      title={hint}
      className={cn(
        'flex h-[var(--height-table-row)] items-center gap-12',
        separated && 'border-t border-line-default',
      )}
    >
      <span className="w-[var(--space-24)] text-style-body-md text-ink-tertiary" aria-hidden="true">
        {operator}
      </span>
      {toggle}
      <span
        className={cn(
          'flex-1 text-style-body-md text-ink-primary',
          strong && 'text-style-heading-sm',
          muted && 'line-through opacity-40',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-right text-style-numeric-md text-ink-primary',
          strong && 'font-medium',
          muted && 'line-through opacity-40',
        )}
      >
        {formatMoney(amount)}
      </span>
    </div>
  )
}

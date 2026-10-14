'use client'

import * as React from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardCaption,
  CardBody,
  CardLinkIcon,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/patterns/loading'
import { formatMoney, previousMonth, type Cents, type Month } from '@/domain/core'
import { leftoverBroughtForward, monthLimit } from '@/domain/discretionary-spending'
import {
  useBankAccounts,
  useDiscretionaryExpenses,
  useDiscretionarySpendingConfig,
  useLeftoverDirections,
} from '../_lib/queries'
import { progressWidthPercent } from '../_lib/discretionary'
import { DiscretionaryConfigureModal } from './modals/discretionary-configure-modal'
import { DiscretionaryDetailModal } from './modals/discretionary-detail-modal'
import { DiscretionaryExpenseModal } from './modals/discretionary-expense-modal'

/**
 * Consumo Livre (estados completos) — files_design/01 §4a.
 *
 * Three states, all in this one widget: A "Configurar" (sem config salva), B
 * "Card no dashboard" (padrão), C "Detalhe" (modal, `DiscretionaryDetailModal`)
 * — plus the "Gastei um valor" popover (`DiscretionaryExpenseModal`), reused
 * from both B and C.
 */
export function DiscretionarySpendingCard({ month }: { month: Month }) {
  const config = useDiscretionarySpendingConfig()
  const expenses = useDiscretionaryExpenses(month)
  const bankAccounts = useBankAccounts()
  const direcionamentos = useLeftoverDirections()
  const [configureOpen, setConfigureOpen] = React.useState(false)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [expenseOpen, setExpenseOpen] = React.useState(false)

  if (config.isPending || bankAccounts.isPending) {
    return (
      <Card>
        <CardBody>
          <Loading lines={3} />
        </CardBody>
      </Card>
    )
  }

  // Estado A — "Configurar": ainda não existe configuração salva.
  if (!config.data) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Saldo para Consumo Livre</CardTitle>
            <CardCaption>Seu limite livre do mês, sem precisar lançar cada gasto.</CardCaption>
          </CardHeader>
          <CardBody>
            <Button onClick={() => setConfigureOpen(true)}>Configurar Consumo Livre</Button>
          </CardBody>
        </Card>
        <DiscretionaryConfigureModal
          open={configureOpen}
          onOpenChange={setConfigureOpen}
          current={null}
        />
      </>
    )
  }

  const spent = (expenses.data?.data ?? []).reduce((sum, e) => sum + e.amount, 0) as Cents
  const accountName =
    bankAccounts.data?.data.find((a) => a.id === config.data?.sourceAccountId)?.label ?? 'conta'
  // P14 — a verba do mês soma a sobra que a pessoa TROUXE de volta, e só ela.
  // Antes desta decisão, `allowanceForMonth` já modelava "verba + sobra" e as
  // telas ignoravam, para o card e o modal não mostrarem números diferentes;
  // agora não há o que ignorar, porque a sobra só entra por decisão.
  // Verba fixa (+ sobra trazida) ou o saldo da conta de origem (2026-09-29).
  const sourceBalance = (bankAccounts.data?.data.find((a) => a.id === config.data?.sourceAccountId)
    ?.balance ?? 0) as Cents
  const verba = monthLimit(
    {
      monthlyAmount: config.data.monthlyAmount as Cents,
      sourceAccountId: config.data.sourceAccountId as never,
      entity: config.data.entity,
      allowanceKind: config.data.allowanceKind,
    },
    {
      previousLeftover: leftoverBroughtForward(
        direcionamentos.data?.data ?? [],
        previousMonth(month),
      ),
      spent,
      sourceBalance,
    },
  )
  const width = progressWidthPercent(spent, verba)

  // Estado B — card padrão do dashboard. O card inteiro abre o Estado C
  // (Detalhe), exceto o botão "Gastei um valor", que abre seu próprio popover
  // (files_design/01 §4a: "Clicar em qualquer parte do card fora do botão").
  //
  // Implementado como um `<button>` real cobrindo o conteúdo, IRMÃO de
  // "Gastei um valor" — nunca um `<div role="button">` envolvendo outro botão:
  // dois controles interativos aninhados confundem leitor de tela e navegação
  // por teclado, mesmo com `stopPropagation` no clique.
  return (
    <>
      <Card interactive>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex w-full flex-col gap-16 p-20 pb-0 text-left"
        >
          <div className="flex items-start justify-between gap-16">
            <div className="flex flex-col gap-4">
              <CardTitle>Saldo para Consumo Livre</CardTitle>
              <CardCaption>Seu limite livre do mês, sem precisar lançar cada gasto.</CardCaption>
            </div>
            <CardLinkIcon />
          </div>
          {/*
           * Mockup 549:110 — wrapper `flex flex-col gap-[var(--espaco-4,4px)]`,
           * o valor em numeric.lg / `--texto-secundario`, e o trilho 549:112
           * com o preenchimento 549:113: 683×31, raio 5 nos dois. O código
           * tinha gap-8, `text-ink-primary` e `rounded-pill` sobre um trilho
           * de 8px — quatro divergências medidas contra o mesmo nó.
           */}
          <div className="flex flex-col gap-4">
            <span className="text-style-numeric-lg text-ink-secondary">
              {formatMoney(spent)} / {formatMoney(verba)}
            </span>
            <div className="h-[var(--height-progress-track)] w-full overflow-hidden rounded-progress-track bg-surface-subtle">
              <div
                className="h-full rounded-progress-track bg-surface-inverse"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
          <p className="text-style-body-sm text-ink-secondary">
            Saindo da conta {accountName} · reabastece dia 1
          </p>
        </button>
        <CardBody className="flex items-center gap-16 border-t border-line-default pt-16">
          <Button onClick={() => setExpenseOpen(true)}>Gastei um valor</Button>
        </CardBody>
      </Card>
      <DiscretionaryDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        month={month}
        config={config.data}
      />
      <DiscretionaryExpenseModal open={expenseOpen} onOpenChange={setExpenseOpen} month={month} />
    </>
  )
}

'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardBody, CardCaption, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MonthNav } from '@/components/patterns/month-nav'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { RateAdjustmentDialog } from '@/components/patterns/rate-adjustment-dialog'
import { MarkInstallmentPaidDialog } from '@/components/patterns/mark-installment-paid-dialog'
import { formatMoney, type Month } from '@/domain/core'
import { LABEL_INSTALLMENT_STATUS } from '@/domain/assets'
import { todayMonth } from '@/lib/today'
import {
  useCategories,
  useLiabilities,
  useOccurrences,
  useRecurrences,
  useStatementBlocks,
  useInstallmentsByLiability,
} from '../_lib/queries'
import { buildReviewRows, type ReviewRow } from '../_lib/view-model'
import { MarkOccurrencePaidDialog } from './mark-occurrence-paid-dialog'
import { DiscardOccurrenceDialog } from './discard-occurrence-dialog'
import { DiscardInstallmentDialog } from './discard-installment-dialog'

type OccurrenceDialog =
  | { kind: 'MarkPaid'; row: Extract<ReviewRow, { kind: 'Occurrence' }> }
  | { kind: 'Discard'; row: Extract<ReviewRow, { kind: 'Occurrence' }> }
  | { kind: 'MarkInstallmentPaid'; row: Extract<ReviewRow, { kind: 'Installment' }> }
  | { kind: 'RateAdjustment'; row: Extract<ReviewRow, { kind: 'Installment' }> }
  | { kind: 'DiscardInstallment'; row: Extract<ReviewRow, { kind: 'Installment' }> }
  | null

/**
 * Revisão de Recorrentes — files_design/01 §6, Figma `10:2`. Checklist mensal
 * das ocorrências que o motor de recorrência já gerou como Previsto, com as
 * parcelas de passivo do mês na mesma lista (files_design/01 §6).
 */
export function RecurrenceReviewScreen() {
  // "Hoje" só existe no dispositivo (src/lib/today.ts) — resolvido depois do
  // mount pra nunca divergir entre o HTML do servidor e a primeira pintura no
  // cliente (mesmo padrão da tela de DRE).
  const [month, setMonth] = React.useState<Month | null>(null)
  const [dialog, setDialog] = React.useState<OccurrenceDialog>(null)

  React.useEffect(() => {
    setMonth(todayMonth())
  }, [])

  const occurrences = useOccurrences(month)
  const recurrences = useRecurrences()
  const categories = useCategories()
  const statementBlocks = useStatementBlocks()
  const liabilities = useLiabilities()
  const liabilityIds = React.useMemo(
    () => (liabilities.data?.data ?? []).map((liability) => liability.id),
    [liabilities.data],
  )
  const installments = useInstallmentsByLiability(liabilityIds)

  const isLoading =
    month === null ||
    occurrences.isLoading ||
    recurrences.isLoading ||
    categories.isLoading ||
    statementBlocks.isLoading ||
    liabilities.isLoading ||
    installments.isLoading
  const isError =
    occurrences.isError ||
    recurrences.isError ||
    categories.isError ||
    statementBlocks.isError ||
    liabilities.isError ||
    installments.isError

  const rows = React.useMemo(() => {
    if (
      month === null ||
      !occurrences.data ||
      !recurrences.data ||
      !categories.data ||
      !statementBlocks.data
    ) {
      return []
    }
    return buildReviewRows({
      occurrences: occurrences.data.data,
      recurrences: recurrences.data.data,
      categories: categories.data.data,
      statementBlocks: statementBlocks.data.data,
      liabilities: liabilities.data?.data ?? [],
      installmentsByLiability: installments.byLiability,
      month,
    })
  }, [
    month,
    occurrences.data,
    recurrences.data,
    categories.data,
    statementBlocks.data,
    liabilities.data,
    installments.byLiability,
  ])

  const noRecurrencesEverConfigured = (recurrences.data?.data.length ?? 0) === 0

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Revisão de Recorrentes</h1>
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Revisão de Recorrentes: os lançamentos que suas recorrências já geraram como Previsto pra
          este mês. Para cada um, marque como pago, edite o valor ou descarte só esta ocorrência.
        </p>
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Navegue entre meses: pra trás revê recorrências de meses passados; pra frente mostra o que
          já está projetado pros próximos meses.
        </p>
        {month ? <MonthNav month={month} onMonthChange={setMonth} /> : null}
      </div>

      <Card>
        {/* Cabeçalho do card — Mockup `822:528` "Card / Recorrências do mês",
            frame `822:529` "Cabeçalho do card" (1088×74), com os dois textos
            literais: `822:530` "Recorrências deste mês" (título) e `822:531`
            a legenda. O card ia direto pra tabela, sem cabeçalho nenhum. */}
        <CardHeader>
          <CardTitle level={2}>Recorrências deste mês</CardTitle>
          <CardCaption>
            Lançamentos gerados automaticamente pelas suas recorrências e parcelas ativas.
          </CardCaption>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <Loading
              label="Carregando Revisão de Recorrentes"
              bars={SKELETON_BARS.REVISAO_DE_RECORRENTES}
            />
          ) : isError ? (
            <div className="flex flex-col items-center gap-12 px-40 py-40 text-center">
              <p className="text-style-body-md font-medium text-ink-primary">
                Não foi possível carregar a Revisão de Recorrentes agora.
              </p>
              <Button
                onClick={() => {
                  void occurrences.refetch()
                  void recurrences.refetch()
                  void categories.refetch()
                  void statementBlocks.refetch()
                  void liabilities.refetch()
                }}
              >
                Tentar novamente
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <Empty
              copy={EMPTY_STATES.REVISAO_DE_RECORRENTES}
              actionHref={noRecurrencesEverConfigured ? '/novo-lancamento' : undefined}
            />
          ) : (
            <ul>
              {rows.map((row) => (
                <ReviewRowItem key={`${row.kind}-${row.id}`} row={row} onAction={setDialog} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {month && dialog?.kind === 'MarkPaid' ? (
        <MarkOccurrencePaidDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          month={month}
          occurrenceId={dialog.row.occurrence.id}
          title={dialog.row.title}
          plannedAmount={dialog.row.amount}
        />
      ) : null}

      {month && dialog?.kind === 'Discard' ? (
        <DiscardOccurrenceDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          month={month}
          occurrenceId={dialog.row.occurrence.id}
          title={dialog.row.title}
        />
      ) : null}

      {dialog?.kind === 'MarkInstallmentPaid' ? (
        <MarkInstallmentPaidDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          liabilityId={dialog.row.liability.id}
          installmentId={dialog.row.installment.id}
          title={dialog.row.title}
          plannedAmount={dialog.row.amount}
        />
      ) : null}

      {dialog?.kind === 'DiscardInstallment' ? (
        <DiscardInstallmentDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          liabilityId={dialog.row.liability.id}
          installmentId={dialog.row.installment.id}
          title={dialog.row.title}
        />
      ) : null}

      {dialog?.kind === 'RateAdjustment' ? (
        <RateAdjustmentDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          liabilityId={dialog.row.liability.id}
          liabilityName={dialog.row.liability.name}
          currentRate={dialog.row.liability.monthlyInterestRate}
          plannedCountFrom={(effectiveFrom) =>
            (installments.byLiability[dialog.row.liability.id] ?? []).filter(
              (installment) =>
                installment.status === 'Planned' && installment.plannedDate >= effectiveFrom,
            ).length
          }
          onSuccess={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}

function ReviewRowItem({
  row,
  onAction,
}: {
  row: ReviewRow
  onAction: (dialog: NonNullable<OccurrenceDialog>) => void
}) {
  const status = row.kind === 'Occurrence' ? row.occurrence.status : row.installment.status
  const isPaid = status === 'Paid'

  return (
    <li className="flex items-center justify-between gap-16 border-b border-line-default px-16 py-12 last:border-0">
      <div className="flex min-w-0 flex-col gap-4">
        <p className="truncate text-style-body-md font-medium text-ink-primary">{row.title}</p>
        <p className="truncate text-style-body-sm text-ink-secondary">{row.subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-24">
        {isPaid ? (
          <span className="text-style-body-sm text-ink-tertiary">
            {row.kind === 'Installment' ? LABEL_INSTALLMENT_STATUS.Paid : 'Pago'}
          </span>
        ) : null}
        {row.amount === null ? (
          <span className="numeric rounded-pill bg-surface-alert px-8 py-4 text-style-label-xs text-ink-alert">
            valor pendente
          </span>
        ) : (
          <span className="numeric text-style-numeric-md text-ink-primary">
            {formatMoney(row.amount)}
          </span>
        )}
        {!isPaid ? (
          <div className="flex items-center gap-4">
            {row.kind === 'Occurrence' ? (
              <>
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => onAction({ kind: 'MarkPaid', row })}
                >
                  Confirmar
                </Button>
                {/* "Editar" abre o formulário inteiro da série, com o alcance
                    escolhido lá (pedido do dono, 2026-10-01) — antes era um
                    diálogo só com o Valor (Figma 34:24). */}
                <Button asChild variant="secondary" size="compact">
                  <Link
                    href={`/novo-lancamento?from=revisao-de-recorrentes&occurrenceId=${row.occurrence.id}`}
                  >
                    Editar
                  </Link>
                </Button>
                <Button
                  variant="secondary"
                  size="compact"
                  className="text-ink-negative"
                  onClick={() => onAction({ kind: 'Discard', row })}
                >
                  Descartar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => onAction({ kind: 'MarkInstallmentPaid', row })}
                >
                  Confirmar
                </Button>
                {/* Figma `10:2`, grupo de ações da linha de Passivo (nó
                    144:12, 298×31): TRÊS botões, na ordem 144:13 "Marcar
                    Pago" (102×31), 144:15 "Editar juros" (94×31) e 144:17
                    "Descartar" (86×31). É o mesmo grupo das linhas de
                    Occurrence (nó 10:34, 267×31) com "Editar juros" no lugar
                    de "Editar" — "Descartar" tem lá e cá a mesma largura e o
                    mesmo texto. O efeito está escrito no frame `34:2` nó
                    34:36 ("A série continua normalmente a partir do mês
                    seguinte"): pula a parcela deste mês, sem deslocar o
                    cronograma nem mexer no saldo devedor (`discardInstallment`
                    em @/domain/assets). */}
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => onAction({ kind: 'RateAdjustment', row })}
                >
                  Editar juros
                </Button>
                <Button
                  variant="secondary"
                  size="compact"
                  className="text-ink-negative"
                  onClick={() => onAction({ kind: 'DiscardInstallment', row })}
                >
                  Descartar
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </li>
  )
}

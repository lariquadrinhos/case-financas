'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/patterns/loading'
import { RateAdjustmentDialog } from '@/components/patterns/rate-adjustment-dialog'
import { MarkInstallmentPaidDialog } from '@/components/patterns/mark-installment-paid-dialog'
import { cents, formatDate, formatMoney, isoDate, type Cents } from '@/domain/core'
import { LABEL_CLASSIFICATION, LABEL_ENTITY } from '@/domain/core/vocabulary'
import { LABEL_INSTALLMENT_STATUS, formatMonthlyRate } from '@/domain/assets'
import { useLiability, useLiabilityInstallments, useLiabilityTraceEvents } from '../_lib/queries'
import type { Installment } from '../_lib/queries'
import { windowInstallments } from '../_lib/installment-window'
import { outstandingBalanceOf } from '../_lib/debt-chart'
import { DebtEvolutionChart } from './debt-evolution-chart'
import { EditLiabilityDialog } from './edit-liability-dialog'

/**
 * Detalhe do Passivo (análise de dívida) — files_design/01 §12, Figma `91:2`.
 * Entrada: botão "Analisar" na lista de Passivos.
 */
export function LiabilityDetailScreen({ liabilityId }: { liabilityId: string }) {
  const liability = useLiability(liabilityId)
  const installments = useLiabilityInstallments(liabilityId)
  const traceEvents = useLiabilityTraceEvents(liabilityId)

  const [editOpen, setEditOpen] = React.useState(false)
  const [rateAdjustmentOpen, setRateAdjustmentOpen] = React.useState(false)
  const [payingInstallment, setPayingInstallment] = React.useState<Installment | null>(null)

  if (liability.isLoading || installments.isLoading) {
    return (
      <Card>
        <Loading label="Carregando Detalhe do Passivo" lines={6} />
      </Card>
    )
  }

  if (liability.isError || !liability.data) {
    return (
      <div className="flex flex-col gap-16">
        <BackLink />
        <Card>
          <div className="flex flex-col items-center gap-12 px-40 py-40 text-center">
            <p className="text-style-body-md font-medium text-ink-primary">
              Não foi possível carregar este passivo.
            </p>
            <Button onClick={() => void liability.refetch()}>Tentar novamente</Button>
          </div>
        </Card>
      </div>
    )
  }

  const items = installments.data?.data ?? []
  const paidCount = items.filter((installment) => installment.status === 'Paid').length
  // Figma 91:99-91:132 / files_design/02: a lista é truncada numa janela
  // ancorada em "hoje", com o rodapé "... N parcelas restantes".
  const installmentWindow = windowInstallments(items, paidCount)
  // "Saldo devedor atual" (Figma `91:2` nó `91:50`): o principal ainda em
  // aberto, o valor presente das parcelas ainda Previstas descontadas à taxa
  // vigente — mesma regra de `@/domain/assets` `outstandingBalance`, re-derivada
  // sobre a forma de fio em vez de reconstruir os tipos marcados do domínio que
  // os grupos do frontend não constroem (CLAUDE.md §5). Não é a soma nominal: o
  // frame imprime R$ 178.400,00 ao lado de "Valor original R$ 320.000,00"
  // (`91:47`) com 348 parcelas de R$ 1.520,00 (`91:104`) por pagar, e a soma
  // delas daria R$ 528.960,00 — maior que a dívida contraída.
  const balance: Cents = outstandingBalanceOf(items, liability.data.monthlyInterestRate)

  return (
    <div className="flex flex-col gap-24">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-style-heading-xl text-ink-primary">{liability.data.name}</h1>
          <p className="text-style-body-sm text-ink-secondary">
            {liability.data.creditor} · {LABEL_ENTITY[liability.data.entity]} ·{' '}
            {LABEL_CLASSIFICATION[liability.data.classification]}
          </p>
        </div>
        <div className="flex items-center gap-8">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Editar dados cadastrais
          </Button>
          <Button variant="secondary" onClick={() => setRateAdjustmentOpen(true)}>
            Registrar reajuste de juros
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Dívida</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-4 gap-16 pt-0">
          <Stat label="Valor original" value={formatMoney(cents(liability.data.originalAmount))} />
          <Stat label="Saldo devedor atual" value={formatMoney(balance)} />
          {/* Figma 91:53 escreve o valor com a unidade: "0,85% a.m.". A lista
              de Passivos carrega a unidade no cabeçalho da coluna ("Taxa
              (a.m.)"), aqui o rótulo é só "Taxa de juros atual", então a
              unidade tem que vir no número. */}
          <Stat
            label="Taxa de juros atual"
            value={`${formatMonthlyRate(liability.data.monthlyInterestRate)} a.m.`}
          />
          <Stat
            label="Parcelas"
            value={`${paidCount} / ${liability.data.installmentCount} pagas`}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolução da dívida (saldo devedor)</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {installments.isError ? (
            <p className="text-style-body-sm text-ink-secondary">
              Não foi possível carregar a evolução da dívida agora.
            </p>
          ) : (
            <>
              <DebtEvolutionChart
                installments={items}
                monthlyInterestRate={liability.data.monthlyInterestRate}
              />
              <p className="mt-16 text-style-body-sm text-ink-secondary">
                Calculado automaticamente com base na taxa de juros e no cronograma de amortização.
                Recalculado a cada reajuste de juros registrado.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {installments.isError ? (
            <p className="px-20 pb-20 text-style-body-sm text-ink-secondary">
              Não foi possível carregar as parcelas agora.
            </p>
          ) : items.length === 0 ? (
            <p className="px-20 pb-20 text-style-body-sm text-ink-secondary">
              Nenhuma parcela gerada pra este passivo.
            </p>
          ) : (
            <>
              <ul>
                {installmentWindow.visible.map((installment) => (
                  <InstallmentRow
                    key={installment.id}
                    installment={installment}
                    onMarkPaid={() => setPayingInstallment(installment)}
                    onEditRate={() => setRateAdjustmentOpen(true)}
                  />
                ))}
              </ul>
              {installmentWindow.remaining > 0 ? (
                <p className="px-20 py-12 text-style-body-sm text-ink-secondary">
                  ... {installmentWindow.remaining}{' '}
                  {installmentWindow.remaining === 1 ? 'parcela restante' : 'parcelas restantes'}
                </p>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de eventos (rastreabilidade)</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {traceEvents.isLoading ? (
            <Loading label="Carregando histórico" lines={3} />
          ) : traceEvents.isError ? (
            <p className="px-20 pb-20 text-style-body-sm text-ink-secondary">
              Não foi possível carregar o histórico de eventos agora.
            </p>
          ) : (traceEvents.data?.data.length ?? 0) === 0 ? (
            <p className="px-20 pb-20 text-style-body-sm text-ink-secondary">
              Nenhum evento registrado ainda pra este passivo.
            </p>
          ) : (
            <ul>
              {traceEvents.data!.data.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start gap-16 border-b border-line-default px-20 py-12 last:border-0"
                >
                  <span className="numeric shrink-0 text-style-body-sm text-ink-tertiary">
                    {formatDate(isoDate(event.date))}
                  </span>
                  <span className="text-style-body-sm text-ink-primary">{event.description}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <EditLiabilityDialog open={editOpen} onOpenChange={setEditOpen} liability={liability.data} />

      <RateAdjustmentDialog
        open={rateAdjustmentOpen}
        onOpenChange={setRateAdjustmentOpen}
        liabilityId={liabilityId}
        liabilityName={liability.data.name}
        currentRate={liability.data.monthlyInterestRate}
        plannedCountFrom={(effectiveFrom) =>
          items.filter((i) => i.status === 'Planned' && i.plannedDate >= effectiveFrom).length
        }
        onSuccess={() => {
          void liability.refetch()
          void installments.refetch()
          void traceEvents.refetch()
        }}
      />

      {payingInstallment ? (
        <MarkInstallmentPaidDialog
          open
          onOpenChange={(open: boolean) => !open && setPayingInstallment(null)}
          liabilityId={liabilityId}
          installmentId={payingInstallment.id}
          title={`Parcela #${payingInstallment.number}`}
          plannedAmount={cents(payingInstallment.plannedAmount)}
          onSuccess={() => void traceEvents.refetch()}
        />
      ) : null}
    </div>
  )
}

function BackLink() {
  return (
    <Link href="/passivos" className="text-style-body-sm text-ink-state hover:opacity-80">
      ← Passivos
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-style-body-sm text-ink-secondary">{label}</p>
      <p className="numeric text-style-numeric-lg text-ink-primary">{value}</p>
    </div>
  )
}

function InstallmentRow({
  installment,
  onMarkPaid,
  onEditRate,
}: {
  installment: Installment
  onMarkPaid: () => void
  /** files_design/01 §12: a ação da linha Paga é o fluxo de Registrar Reajuste
   *  de Juros — o mesmo que o botão homônimo do cabeçalho abre. */
  onEditRate: () => void
}) {
  const isPaid = installment.status === 'Paid'
  return (
    <li className="flex items-center gap-16 border-b border-line-default px-20 py-12 last:border-0">
      <span className="numeric w-40 shrink-0 text-style-body-sm text-ink-secondary">
        #{installment.number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <span className="numeric text-style-body-md text-ink-primary">
          {formatDate(isoDate(installment.plannedDate))}
        </span>
        <span className="text-style-body-sm text-ink-secondary">
          Previsto: {formatMoney(cents(installment.plannedAmount))}
          {isPaid && installment.paidAmount !== null
            ? ` · Pago: ${formatMoney(cents(installment.paidAmount))}`
            : ''}
        </span>
      </div>
      {/* Paga e Prevista usam a MESMA Etiqueta, só o tipo muda. Medido no
          Mockup 948:1687 (claro) / 952:1717 (escuro), card 950:33: as quatro
          linhas trazem uma instance "Etiqueta" — 950:40 e 950:49 (47×22) nas
          Pagas, 950:58 e 950:67 (72×22) nas Previstas. O get_design_context de
          950:35 dá a pílula da Paga como `--fundo-positivo-sutil` +
          `--texto-positivo` + `--raio-pilula`, que é exatamente `tone="pago"`:
          são os mesmos três valores de `--color-bg-positive-subtle`,
          `--color-text-positive` e `--radius-pill` em tokens.css.
          A regra de files_design/07 "Hierarquia de cor" que pede 'Pago' em
          cinza terciário está escopada em "Status na TABELA"; aqui o Mockup
          desenha uma LISTA de linhas (950:35 "Linha") e pinta a pílula verde,
          então ela não se aplica a este card. */}
      <Badge tone={isPaid ? 'pago' : 'previsto'}>
        {LABEL_INSTALLMENT_STATUS[installment.status]}
      </Badge>
      {/* TODA linha tem ação, Paga inclusive — só o rótulo muda.
          Wireframe `91:2`, card 337:3: as quatro linhas repetem a mesma coluna
          de botão — 91:106/91:107 e 91:114/91:115 ("Editar", 56×25) nas Pagas,
          91:122/91:123 e 91:130/91:131 ("Marcar Paga", 91×25) nas Previstas.
          O botão da linha Paga sobreviveu à camada visual: Mockup 948:1687
          (claro) / 952:1717 (escuro), card 950:33, instances "Botão" 950:42 e
          950:51, ambas 71×44 em x=953, contra 115×44 (950:60/950:69) nas
          Previstas. O rótulo curto é o medido: o texto da instance da linha
          Paga mede 39 de largura contra 83 do da Prevista — "Editar juros", o
          nome que files_design/01 §12 dá ao fluxo, é MAIS largo que "Marcar
          Paga" e não caberia; por isso vale o literal do Wireframe, "Editar".
          Não é reabertura de pagamento (`markInstallmentPaid` recusa com
          `installment_payment.already_paid`, e continua certo): §12 e §11
          dizem que a ação da linha de Passivo "abre o fluxo de Registrar
          Reajuste de Juros", que é o `RateAdjustmentDialog` já montado acima —
          o valor da parcela é calculado por amortização, não digitado. */}
      <Button variant="secondary" size="compact" onClick={isPaid ? onEditRate : onMarkPaid}>
        {isPaid ? 'Editar' : 'Marcar Paga'}
      </Button>
    </li>
  )
}

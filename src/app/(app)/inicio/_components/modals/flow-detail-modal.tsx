'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'
import { formatMoney, type Cents } from '@/domain/core'
import { ModalBackLink } from './modal-back-link'

export interface FlowRow {
  readonly name: string
  readonly amount: Cents
}

export interface FlowSelection {
  readonly name: string
  /** Total shown on the block/row that was clicked — "este mês". */
  readonly total: Cents
  readonly rows: readonly FlowRow[]
}

/**
 * Detalhe do Fluxo — modal sobre Início, docs/figma/frames/
 * 349-2__desktop-detalhe-do-fluxo-modal-sobre-inicio.xml, node 349:252.
 *
 * Opened by clicking a row of "Entradas e Saídas" (files_design/01 §13):
 * "só consulta, sem ação de mover — pra mover dinheiro, a pessoa usa Onde
 * Está Meu Dinheiro." No form, no button beyond closing.
 */
export const FLOW_DETAIL_FOOTNOTE =
  'Só consulta — pra mover esse dinheiro pra outro lugar, use Onde Está Meu Dinheiro.'

export function FlowDetailModal({
  selection,
  open,
  onOpenChange,
  backLabel = 'Entradas e Saídas',
  footnote = FLOW_DETAIL_FOOTNOTE,
}: {
  selection: FlowSelection | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** O card de onde o modal foi aberto — o "←" volta pra Home em qualquer caso. */
  backLabel?: string
  footnote?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 480 de largura: frame 349:252 (Wireframe), o contêiner do modal em 349:2. */}
      <DialogContent width="narrow" aria-describedby={undefined}>
        {selection ? (
          <FlowDetailBody selection={selection} backLabel={backLabel} footnote={footnote} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function FlowDetailBody({
  selection,
  backLabel,
  footnote,
}: {
  selection: FlowSelection
  backLabel: string
  footnote: string
}) {
  return (
    <>
      <DialogHeader className="gap-16">
        <ModalBackLink label={backLabel} />
        <div className="flex flex-col gap-4">
          {/* O nome do bloco É o título do diálogo (frame 349:256). Como
              <DialogTitle> ele também vira o nome acessível do modal — um
              <span> deixava o diálogo sem nome nenhum pro leitor de tela. */}
          <DialogTitle className="text-style-heading-xl">{selection.name}</DialogTitle>
          <span className="text-style-body-sm text-ink-secondary">
            {formatMoney(selection.total)} este mês
          </span>
        </div>
      </DialogHeader>
      <DialogBody>
        <DialogDescription className="sr-only">
          Lançamentos que compõem o valor de {selection.name} este mês.
        </DialogDescription>
        <h3 className="text-style-label-xs text-ink-secondary">
          Lançamentos que compõem este valor
        </h3>
        <ul className="flex flex-col">
          {selection.rows.map((row, index) => (
            <li
              key={`${row.name}-${index}`}
              className="flex items-center justify-between gap-16 border-b border-line-default py-12 last:border-0"
            >
              <span className="text-style-body-md text-ink-primary">{row.name}</span>
              <span className="numeric text-style-body-md text-ink-primary">
                {formatMoney(row.amount)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-style-body-sm text-ink-secondary">{footnote}</p>
      </DialogBody>
    </>
  )
}

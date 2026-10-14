import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Table — the "Lançamentos deste mês" sheet under the DRE cascade, the Histórico
 * list, the Parcelas list, the Eventos Recentes log.
 *
 * A real `<table>`, not a grid of divs: these are tabular data and a screen
 * reader needs the row/column relationship to read a cell as
 * "Aluguel, Valor, R$ 1.520,00".
 *
 * files_design/07 densidade #1/#2/#4: fixed 44px row height, numbers always
 * right-aligned with tabular figures, header in small caps grey (label.xs) —
 * never bold black. #3: one hairline divider, no zebra striping.
 */

/**
 * `maxRows` caps how many data rows are visible at once, scrolling the rest —
 * files_design/02 "Limite de linhas no Histórico": "10 linhas visíveis por
 * vez, com scroll pro resto — cabeçalho da tabela fica sempre visível, fora
 * da área de scroll" (Figma `9:2`, scroll frame `295:2`). Omit it and the
 * table grows to fit, which is right for the short, bounded lists (Parcelas,
 * Lançamentos deste mês) that never run long enough to need a scroller.
 */
export function Table({
  className,
  maxRows,
  style,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { maxRows?: number }) {
  return (
    <div
      className={cn('w-full overflow-x-auto', maxRows !== undefined && 'overflow-y-auto')}
      style={
        maxRows === undefined
          ? undefined
          : { maxHeight: `calc(var(--height-table-row) * ${maxRows + 1})` }
      }
    >
      <table className={cn('w-full border-collapse', className)} style={style} {...props} />
    </div>
  )
}

/**
 * `sticky` keeps the header outside the scrolled area when the table is
 * capped by `maxRows` — the header of a scrolling list has to stay readable,
 * or the columns stop meaning anything past row 10.
 */
export function TableHead({
  className,
  sticky = false,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        'border-b border-line-default',
        sticky && 'sticky top-0 bg-surface-card',
        className,
      )}
      {...props}
    />
  )
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />
}

/**
 * `interactive` — files_design/07 "Linha de tabela": Hover + Foco no Dado,
 * "só faz sentido onde a linha inteira é clicável" (Histórico, Entradas e
 * Saídas → Detalhe do Fluxo). A real focusable target (`tabIndex`, `Enter`/`
 * Espaço` activate `onClick`), never a `<div onClick>` standing in for a row.
 */
export function TableRow({
  className,
  interactive = false,
  onClick,
  onKeyDown,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (interactive && onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onClick(event as unknown as React.MouseEvent<HTMLTableRowElement>)
        }
        onKeyDown?.(event)
      }}
      className={cn(
        'h-[var(--height-table-row)] border-b border-line-default last:border-0',
        interactive && 'cursor-pointer transition-colors hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  )
}

export function TableHeader({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-12 text-left text-style-label-xs text-ink-secondary',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-12 text-ink-primary',
        numeric ? 'text-style-numeric-md text-right' : 'text-style-body-md',
        className,
      )}
      {...props}
    />
  )
}

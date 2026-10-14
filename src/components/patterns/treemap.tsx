'use client'

import * as React from 'react'
import { toReais, type Cents } from '@/domain/core'
import { cn } from '@/lib/cn'
import { prepareTreemapItems, rampStep, squarifyTreemap, stripWidth } from '@/lib/treemap'
import type { TreemapItem, TreemapRect } from '@/lib/treemap'

/** files_design/08 §1: inside a chart mark, money drops the cents. */
function formatMoneyNoCents(value: Cents): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toReais(value))
}

const RAMP_BG: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: 'bg-chart-ramp-1',
  2: 'bg-chart-ramp-2',
  3: 'bg-chart-ramp-3',
  4: 'bg-chart-ramp-4',
  5: 'bg-chart-ramp-5',
  6: 'bg-chart-ramp-6',
}

const ARROW_SIZE = 14
const ARROW_GAP = 8

function ArrowDiagonalIcon({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      aria-hidden="true"
      width={ARROW_SIZE}
      height={ARROW_SIZE}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      style={style}
    >
      <path d="M5 9.5 9.5 5M5.7 5h3.8v3.8" />
    </svg>
  )
}

export interface TreemapProps {
  items: readonly TreemapItem[]
  /** files_design/08 §2.3: só a ALTURA é fixa por uso; a largura acompanha o card. */
  height: number
  /**
   * Fração da largura disponível que a faixa ocupa (files_design/08 §2.3: a
   * faixa de dívidas usa `total_dividas / total_ativos` da largura da faixa de
   * ativos, limitada a ela). `1` — o padrão — é "a largura inteira do card".
   */
  widthRatio?: number
  /**
   * Piso da largura em px (files_design/08 §2.11): a faixa proporcional nunca
   * fica tão estreita que o §2.6 esconda o rótulo. `0` — o padrão — é sem piso.
   */
  minWidth?: number
  /** filled = rampa colorida (Despesas por Categoria, faixa de Ativos); outlined = bloco vazado (faixa de Dívidas). */
  variant?: 'filled' | 'outlined'
  othersLabel?: string
  onSelect?: (item: TreemapItem) => void
  className?: string
}

/**
 * Treemap — files_design/08 §2. Squarified layout via `src/lib/treemap.ts`
 * (no charting library — CLAUDE.md forbids one on the client). Rendered as a
 * grid of real `<button>`s, not `<div onClick>`, so keyboard focus and the
 * global `:focus-visible` ring (globals.css) work with no extra code.
 *
 * A largura é MEDIDA do contêiner, nunca fixada em código: files_design/08
 * §2.3 dá altura fixa por uso e diz que a largura "acompanha o card". Fixar a
 * largura do mockup (1018px, do frame de 1440) fazia os blocos vazarem pra
 * fora do card e a página inteira ganhar rolagem horizontal em qualquer tela
 * mais estreita que o mockup.
 */
export function Treemap({
  items,
  height,
  widthRatio = 1,
  minWidth = 0,
  variant = 'filled',
  othersLabel = 'Outras',
  onSelect,
  className,
}: TreemapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = React.useState(0)

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailableWidth(entry.contentRect.width)
    })
    observer.observe(element)
    setAvailableWidth(element.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  const width = stripWidth(availableWidth, widthRatio, minWidth)

  const prepared = React.useMemo(
    () => prepareTreemapItems(items, othersLabel),
    [items, othersLabel],
  )
  const rects = React.useMemo(
    () => squarifyTreemap(prepared, width, height),
    [prepared, width, height],
  )

  if (prepared.length === 0) return null

  return (
    <div ref={containerRef} className={cn('w-full', className)} style={{ height }}>
      <div
        className="relative"
        style={{ width, height }}
        role="group"
        aria-label="Blocos proporcionais ao valor"
      >
        {rects.map((rect) => (
          <TreemapBlock
            key={rect.id}
            rect={rect}
            total={rects.length}
            variant={variant}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function TreemapBlock({
  rect,
  total,
  variant,
  onSelect,
}: {
  rect: TreemapRect
  total: number
  variant: 'filled' | 'outlined'
  onSelect?: (item: TreemapItem) => void
}) {
  // §2.6: the sacrifice ladder, by the block's OWN size, not the whole card.
  const showArrow = rect.w >= 120
  const showValue = rect.h >= 56
  const showNothing = rect.w < 64 || rect.h < 32
  const paddingX = rect.w < 120 ? 10 : 12
  const paddingY = rect.h < 70 ? 8 : 10
  // §2.6: "o nome corta com reticências antes de encostar no ícone". A seta é
  // absoluta, por cima do texto; sem esta reserva as reticências ficavam por
  // baixo dela (medido em 2026-09-23 num bloco de 110px).
  const nameReserve = showArrow ? ARROW_SIZE + ARROW_GAP : undefined

  const step = rampStep(rect.rank - 1, total)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(rect)}
      aria-label={`${rect.name}, ${formatMoneyNoCents(rect.value)}`}
      className={cn(
        'group absolute overflow-hidden rounded-treemap-block border border-line-control text-left',
        'transition-colors hover:border-line-strong',
        variant === 'filled' ? RAMP_BG[step] : 'bg-surface-card',
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      {/* files_design/08 §2.9: 8% black multiply overlay on hover, both variants. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/[0.08]"
      />
      {!showNothing ? (
        // §2.6 + Figma frame 5-2: nome e valor no TOPO do bloco (y=10), na
        // mesma altura da seta — centralizado, num bloco de 150px o nome
        // descia ~55px abaixo dela.
        <span
          className="flex h-full flex-col justify-start"
          style={{ padding: `${paddingY}px ${paddingX}px` }}
        >
          <span
            className={cn(
              'truncate text-style-body-sm font-medium',
              variant === 'filled' ? 'text-ink-on-block' : 'text-ink-primary',
            )}
            style={{ paddingRight: nameReserve }}
          >
            {rect.name}
          </span>
          {showValue ? (
            <span
              className={cn(
                'numeric truncate text-style-body-sm',
                variant === 'filled' ? 'text-ink-on-block' : 'text-ink-secondary',
              )}
            >
              {formatMoneyNoCents(rect.value)}
            </span>
          ) : null}
        </span>
      ) : null}
      {showArrow ? (
        // files_design/08 §2.6: same inset as the name/value text, anchored
        // independently in the corner — never pushed by the name's length.
        <ArrowDiagonalIcon
          className={cn(
            'absolute',
            variant === 'filled' ? 'text-ink-on-block' : 'text-ink-secondary',
          )}
          style={{ right: paddingX, top: paddingY }}
        />
      ) : null}
    </button>
  )
}

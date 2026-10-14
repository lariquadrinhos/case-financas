'use client'

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/cn'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * O diálogo de "Descartar" da Revisão de Recorrentes, transcrito do Figma
 * `34:2` estado ③ (nó 34:31): título 34:35 `Descartar "{nome}" deste mês?`,
 * corpo 34:36 "A série continua normalmente a partir do mês seguinte.",
 * botões 34:39 "Cancelar" e 34:41 "Descartar".
 *
 * Uma linha de Ocorrência (Figma `10:2` nó 10:39) e uma linha de Parcela de
 * Passivo (nó 144:17) usam o MESMO diálogo — o frame desenha os dois botões
 * "Descartar" com a mesma largura (86×31) e o mesmo texto, e o nó 34:42 diz
 * "Disponível para qualquer recorrência". Por isso o texto mora aqui uma vez
 * só, e cada tipo de linha entra apenas com a sua mutation.
 */
export function DiscardThisMonthDialog({
  open,
  onOpenChange,
  title,
  isPending,
  isError,
  onConfirm,
  offerWholeSeries = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  isPending: boolean
  isError: boolean
  /** `wholeSeries`: também encerrar a série neste mês. Sempre `false` sem a escolha. */
  onConfirm: (wholeSeries: boolean) => void
  /**
   * Numa recorrência, "Só este mês" ou "A série completa" (pedido do dono,
   * 2026-10-01). Uma parcela de Passivo não oferece: o Passivo tem cronograma.
   */
  offerWholeSeries?: boolean
}) {
  const [scope, setScope] = React.useState<'ThisOnly' | 'WholeSeries'>('ThisOnly')
  const wholeSeries = offerWholeSeries && scope === 'WholeSeries'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 460 de largura, o diálogo-formulário (ver `form` em components/ui/dialog.tsx).
          Desenhado na Mockup em 2026-09-11 sobre a Revisão de Recorrentes:
          `Desktop — Descartar Ocorrência do Mês (claro)` (`1417:6554`, diálogo
          `1415:7008`) e `(escuro)` (`1417:6659`). Até então só existia o
          esquema `34:2` do Wireframe, em escala reduzida (colunas de 400 com
          360 internos) — esquema, não geometria. */}
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Descartar &quot;{title}&quot; deste mês?</DialogTitle>
          <DialogDescription>
            {wholeSeries
              ? 'A recorrência é encerrada: este mês e os seguintes deixam de aparecer; os meses anteriores continuam como estão.'
              : 'A série continua normalmente a partir do mês seguinte.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {offerWholeSeries ? (
            <RadioGroupPrimitive.Root
              value={scope}
              onValueChange={(value) => setScope(value as 'ThisOnly' | 'WholeSeries')}
              aria-label="Descartar"
              className="flex flex-col gap-8"
            >
              {(
                [
                  ['ThisOnly', 'Só este mês'],
                  // Era "A série completa (encerra a recorrência)" (dono,
                  // 2026-10-06): o efeito sempre foi deste mês em diante —
                  // `closeRecurrence` na data deste mês, os anteriores intactos.
                  ['WholeSeries', 'Deste mês em diante (mantém os anteriores)'],
                ] as const
              ).map(([option, label]) => (
                <RadioGroupPrimitive.Item
                  key={option}
                  value={option}
                  className={cn(
                    'flex h-[var(--height-control)] w-full items-center rounded-control border px-16 text-left',
                    'text-style-body-md text-ink-primary outline-none transition-colors',
                    'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
                    scope === option
                      ? 'border-line-focus bg-surface-state'
                      : 'border-line-default hover:bg-surface-hover',
                  )}
                >
                  {label}
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
          ) : null}
          {isError ? (
            <p role="alert" className="text-style-body-sm text-ink-negative">
              Não foi possível descartar. Tente novamente.
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={isPending} onClick={() => onConfirm(wholeSeries)}>
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

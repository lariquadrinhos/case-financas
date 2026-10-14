'use client'

import { Card, CardBody, CardHeader, CardTitle, CardCaption } from '@/components/ui/card'
import { Empty } from '@/components/patterns/empty'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { formatDate, type IsoDate } from '@/domain/core'
import { describeEventForHome } from '@/domain/trace-events'
import { useRecentEvents } from '../_lib/queries'

/**
 * Eventos Recentes — files_design/01 §4, files_design/08 §9.3.
 *
 * A coluna de data usa `--width-event-date`, medido na linha `549:280` do card
 * `549:278` (Mockup): data `549:281` "20/07/2026" em x=16 w=71, descrição
 * `549:282` em x=103, ou seja 16 de respiro; a data mais larga desenhada é 73
 * (`549:287`). Até esta correção ela reaproveitava `--width-month-label`, que é
 * a célula do rótulo do SELETOR DE MÊS (Mockup 398:22, 100×36) — outro
 * componente e outro significado, e acertar um mexia no outro. */
export function RecentEventsCard() {
  const { data, isPending, isError } = useRecentEvents()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eventos Recentes</CardTitle>
        <CardCaption>Últimos 5: reajustes, divergências e parcelas confirmadas</CardCaption>
      </CardHeader>
      <CardBody>
        {isPending || !data ? (
          <Loading bars={SKELETON_BARS.EVENTOS_RECENTES} />
        ) : isError ? (
          <p className="text-style-body-sm text-ink-secondary">
            Não foi possível carregar os eventos agora.
          </p>
        ) : data.data.length === 0 ? (
          <Empty copy={EMPTY_STATES.EVENTOS_RECENTES} />
        ) : (
          <ul className="flex flex-col">
            {data.data.map((event) => (
              <li
                key={event.id}
                className="flex h-[var(--height-table-row)] items-center gap-16 border-b border-line-default last:border-0"
              >
                <span className="numeric min-w-[var(--width-event-date)] shrink-0 text-style-body-sm text-ink-tertiary">
                  {formatDate(event.date as IsoDate)}
                </span>
                {/* P35: o texto gravado é o do Detalhe do Passivo — sem o nome
                    da dívida, com o sufixo de divergência. Aqui é o inverso, e
                    a troca é do domínio, não desta tela. */}
                <span className="text-style-body-md text-ink-primary">
                  {describeEventForHome(event.kind, event.description, event.subject)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

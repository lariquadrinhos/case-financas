import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cents } from '@/domain/core'
import { MarkAsPaidDialog } from './mark-as-paid-dialog'
import { MarkInstallmentPaidDialog } from './mark-installment-paid-dialog'
import { MarkOccurrencePaidDialog } from '../../app/(app)/revisao-de-recorrentes/_components/mark-occurrence-paid-dialog'

/**
 * Medido em 2026-10-09: todo Previsto do dono está numa conta vinculada ao
 * Open Finance, e o servidor recusa o "Confirmar" com 409
 * `open_finance.account_is_linked` e a frase que explica (src/api/http.ts).
 * Os três diálogos mostravam só "Não foi possível confirmar o pagamento. Tente
 * novamente." — uma instrução que nunca funciona.
 */

const DETAIL =
  'Esta conta está vinculada ao Open Finance: o que é pago nela chega pelo banco. Lance como Previsto, ou desvincule a conta.'

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: 409,
            title: 'Conflito',
            detail: DETAIL,
            code: 'open_finance.account_is_linked',
          }),
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    ),
  )
})

afterEach(() => vi.unstubAllGlobals())

describe('diálogos de "Confirmar" — mostram o motivo da recusa (medido em 2026-10-09)', () => {
  it('2026-10-09 — lançamento: mostra a frase do servidor, não "Tente novamente"', async () => {
    const user = userEvent.setup()
    wrap(
      <MarkAsPaidDialog
        open
        onOpenChange={() => {}}
        entryId={'entry-1' as never}
        entryName="Lançamento sintético"
        plannedAmount={cents(1000)}
        onPaid={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(DETAIL)).toBeInTheDocument()
    expect(screen.queryByText(/Tente novamente/)).toBeNull()
  })

  it('2026-10-09 — ocorrência de recorrência: mostra a frase do servidor', async () => {
    const user = userEvent.setup()
    wrap(
      <MarkOccurrencePaidDialog
        open
        onOpenChange={() => {}}
        month={'2026-10' as never}
        occurrenceId="serie-1:2026-10"
        title="Série sintética"
        plannedAmount={cents(1000)}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(DETAIL)).toBeInTheDocument()
    expect(screen.queryByText(/Tente novamente/)).toBeNull()
  })

  it('2026-10-09 — parcela de Passivo: mostra a frase do servidor', async () => {
    const user = userEvent.setup()
    wrap(
      <MarkInstallmentPaidDialog
        open
        onOpenChange={() => {}}
        liabilityId="passivo-1"
        installmentId="passivo-1#3"
        title="Parcela sintética"
        plannedAmount={cents(1000)}
      />,
    )
    const botoes = screen
      .getAllByRole('button')
      .filter(
        (b) => b.getAttribute('type') === 'submit' || /Confirmar|Marcar/.test(b.textContent ?? ''),
      )
    await user.click(botoes[botoes.length - 1]!)
    expect(await screen.findByText(DETAIL)).toBeInTheDocument()
    expect(screen.queryByText(/Tente novamente/)).toBeNull()
  })
})

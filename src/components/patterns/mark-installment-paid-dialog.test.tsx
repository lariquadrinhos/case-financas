import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cents } from '@/domain/core'
import { MarkInstallmentPaidDialog } from './mark-installment-paid-dialog'

/**
 * O id de uma Parcela é a chave natural `${liabilityId}#${number}`
 * (src/domain/assets/installments.ts:160), e um `#` cru vira FRAGMENTO na URL.
 * Medido:
 *
 *   new URL('http://x/api/v1/installments/<uuid>#12/payment').pathname
 *   → '/api/v1/installments/<uuid>'          // o "/payment" some
 *
 * Ou seja: sem `encodeURIComponent`, o servidor nunca vê a ação e "Marcar
 * Pago" numa parcela fica quebrado nas TRÊS telas que usam este diálogo — DRE,
 * Detalhe do Passivo e Revisão de Recorrentes.
 *
 * O irmão `useDiscardInstallment` (src/app/(app)/revisao-de-recorrentes/_lib/
 * mutations.ts:86-93) já carrega esse mesmo diagnóstico no comentário e já
 * codifica; este diálogo tinha ficado de fora.
 */

const LIABILITY_ID = '11111111-2222-3333-4444-555555555555'
const INSTALLMENT_ID = `${LIABILITY_ID}#12`

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MarkInstallmentPaidDialog
        open
        onOpenChange={() => {}}
        liabilityId={LIABILITY_ID}
        installmentId={INSTALLMENT_ID}
        title="Parcela 12 de 360"
        plannedAmount={cents(152000)}
      />
    </QueryClientProvider>,
  )
}

describe('MarkInstallmentPaidDialog — a URL da parcela precisa codificar o "#"', () => {
  let calls: string[]

  beforeEach(() => {
    calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        calls.push(String(input))
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('chama /installments/{id}/payment com o id codificado, para o "/payment" sobreviver', async () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(calls.length).toBeGreaterThan(0))

    const url = calls[0] as string
    // O que de fato chega ao servidor: sem o encode, o `#12/payment` inteiro
    // vira fragmento e o pathname para no uuid.
    const pathname = new URL(url, 'http://localhost').pathname
    expect(pathname).toBe(`/api/v1/installments/${encodeURIComponent(INSTALLMENT_ID)}/payment`)
    expect(pathname.endsWith('/payment')).toBe(true)
    expect(url).not.toContain('#')
  })
})

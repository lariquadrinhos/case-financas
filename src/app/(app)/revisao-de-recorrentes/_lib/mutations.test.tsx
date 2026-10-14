import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as React from 'react'
import { useDiscardInstallment } from './mutations'

/**
 * O id de uma Parcela é a chave natural `${liabilityId}#${number}`
 * (src/domain/assets/installments.ts) — um `#` cru numa URL é FRAGMENTO, e o
 * servidor nunca recebe o resto do caminho. Medido antes da correção:
 * `new URL('/api/v1/installments/<uuid>#13/discard', origin).pathname` devolve
 * `/api/v1/installments/<uuid>`, e o POST ao vivo respondia a página 404 do
 * Next; com o id codificado, 200 e `discarded: true`.
 */
const INSTALLMENT_ID = 'e2305f47-f328-4057-b953-5c1043437bf4#13'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useDiscardInstallment — o "#" do id de Parcela não pode virar fragmento de URL', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ discarded: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as never
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('mantém o número da parcela no PATHNAME que o servidor recebe', async () => {
    const { result } = renderHook(() => useDiscardInstallment('e2305f47'), { wrapper })

    result.current.mutate(INSTALLMENT_ID)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())

    const called = String(fetchSpy.mock.calls[0]![0])
    expect(new URL(called, 'http://localhost').pathname).toBe(
      '/api/v1/installments/e2305f47-f328-4057-b953-5c1043437bf4%2313/discard',
    )
  })
})

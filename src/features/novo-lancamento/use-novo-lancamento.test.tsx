import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePatchEntry } from './use-novo-lancamento'

vi.mock('@/lib/api-client', async (original) => ({
  ...(await original<typeof import('@/lib/api-client')>()),
  apiPatch: vi.fn(async () => ({})),
}))

describe('usePatchEntry', () => {
  it('dono 2026-10-06 — salvar uma edição recarrega a tela de trás (o DRE), não só a lista de lançamentos', async () => {
    const client = new QueryClient()
    const dre = ['income-statement', 'Consolidated', '2026-10', 'Paid', '', false, false]
    client.setQueryData(dre, { rows: [] })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePatchEntry(), { wrapper })
    await act(() =>
      result.current.mutateAsync({ id: 'entry-1', body: { kind: 'Expense', isCreditCard: true } }),
    )
    expect(client.getQueryState(dre)?.isInvalidated).toBe(true)
  })
})

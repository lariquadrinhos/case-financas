import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cents, month } from '@/domain/core'
import { DestinarOLucroDialog } from './destinar-o-lucro-dialog'

/**
 * Achado de auditoria: por ~1-2s após abrir, o nome de um investimento/conta
 * já salvo aparecia como o UUID interno bruto, antes de virar o nome de
 * verdade. Causa: `loading` (linha ~154, antes do fix) considerava só
 * `existing` (a destinação), nunca as duas queries de nome
 * (`investments`/`bankAccounts`, antes chamadas só dentro de `BucketCard`) —
 * então o modal saía de "Carregando destinação" e desenhava os itens com um
 * mapa de nomes ainda vazio, caindo no fallback pro id bruto em
 * `destinationLabel` (linhas 316-319).
 *
 * Reproduzido abaixo com `/profit-allocations/{month}` resolvendo rápido e
 * `/bank-accounts` resolvendo alguns milissegundos depois — a mesma corrida
 * do relato ao vivo (~0,5s vs ~2s), só que comprimida. O ponto de checagem
 * usa o estado da própria query (`getQueryState`), não um sinal de UI, então
 * a checagem acontece exatamente quando `existing` resolveu, independente de
 * quantos re-renders o React já fez.
 */

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const BANK_ACCOUNT_ID = 'cfbe584d-c06b-43b2-9a01-a3ce50593381'
const BANK_ACCOUNT_DELAY_MS = 80

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/profit-allocations/')) {
        return jsonResponse({
          month: '2026-07',
          netProfit: cents(100_000),
          unallocatedBalance: cents(0),
          items: {
            InvestmentContribution: [],
            DividendReinvestment: [],
            ExtraordinaryConsumption: [],
            CashReserve: [
              {
                destination: { kind: 'BankAccount', bankAccountId: BANK_ACCOUNT_ID },
                amount: cents(100_000),
              },
            ],
          },
        })
      }
      if (url.includes('/investments')) {
        return jsonResponse({ data: [], meta: { total: 0 } })
      }
      if (url.includes('/bank-accounts')) {
        await new Promise((resolve) => setTimeout(resolve, BANK_ACCOUNT_DELAY_MS))
        return jsonResponse({
          data: [
            {
              id: BANK_ACCOUNT_ID,
              label: 'Nubank',
              colour: 'nubank',
              entity: 'PF',
              balance: cents(0),
            },
          ],
          meta: { total: 1 },
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

describe('Destinar o Lucro — nome do destino não pode aparecer como UUID bruto (condição de corrida)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('não mostra o UUID bruto no instante em que a destinação salva termina de carregar', async () => {
    stubFetch()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={client}>
        <DestinarOLucroDialog
          month={month('2026-07')}
          netProfit={cents(100_000)}
          open
          onOpenChange={() => {}}
        />
      </QueryClientProvider>,
    )

    // Ponto de checagem: exatamente quando a query da destinação (`existing`)
    // resolveu — antes que `/bank-accounts` (80ms depois) tenha voltado.
    await waitFor(() => {
      expect(client.getQueryState(['profit-allocation', month('2026-07')])?.status).toBe('success')
    })

    // Nunca o UUID bruto — nem por um instante. É exatamente isto que falhava
    // sem o fix: `destinationLabel` caía no id porque o mapa de nomes ainda
    // estava vazio (`bank-accounts` só volta 80ms depois).
    expect(screen.queryByText(BANK_ACCOUNT_ID)).toBeNull()

    // Eventualmente (depois que `bank-accounts` também resolve) o nome de
    // verdade aparece — o modal não fica preso em loading para sempre.
    await waitFor(() => expect(screen.getByText('Nubank')).toBeInTheDocument())
    expect(screen.queryByText(BANK_ACCOUNT_ID)).toBeNull()
  })
})

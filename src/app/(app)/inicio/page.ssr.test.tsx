import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './page'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

/**
 * O HTML do servidor não pode conter nada derivado do relógio — é a regra que
 * `dre/page.tsx` já seguia e que esta página violava em dois pontos: a saudação
 * (`new Date().getHours()`) e o mês (`todayMonth`), ambos lidos no inicializador
 * do `useState`, que roda TAMBÉM no servidor.
 *
 * MEDIDO em 2026-09-12, com o servidor em Asia/Tokyo e o navegador no fuso
 * local: o HTML vinha com "Boa noite" e o cliente renderizava "Boa tarde".
 * É o "A tree hydrated but some attributes of the server rendered HTML didn't
 * match the client properties" que o React relata — e não precisa de fuso
 * diferente para acontecer: basta o HTML do servidor ser reaproveitado depois
 * de o relógio cruzar a fronteira de uma saudação ou de um mês.
 *
 * O teste renderiza no SERVIDOR de propósito. Uma renderização de cliente não
 * pegaria nada: o `@testing-library` descarrega os efeitos, então o valor já
 * chega preenchido e o defeito fica invisível.
 */
describe('Início — o SSR não pode carregar valor de relógio', () => {
  function ssr() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return renderToString(
      <QueryClientProvider client={client}>
        <HomePage />
      </QueryClientProvider>,
    )
  }

  it('não imprime saudação no HTML do servidor', () => {
    const html = ssr()
    for (const saudacao of ['Bom dia', 'Boa tarde', 'Boa noite']) {
      expect(html).not.toContain(saudacao)
    }
  })

  it('não imprime o mês corrente no HTML do servidor', () => {
    const html = ssr()
    // Qualquer "YYYY-MM" seria um mês resolvido no servidor.
    expect(html).not.toMatch(/\b20\d{2}-\d{2}\b/)
  })
})

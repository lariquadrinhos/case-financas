import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { todayIsoDate, todayMonth } from '@/lib/today'
import { RecurrenceReviewScreen } from './recurrence-review-screen'

/**
 * Linha de Parcela de Passivo na Revisão de Recorrentes.
 *
 * Fonte medida, não deduzida: docs/figma/frames/10-2__desktop-revisao-de-
 * recorrentes.xml, nó 144:6 ("Financiamento apartamento, parcela 13/360" /
 * "Passivo · Caixa Econômica · valor calculado (amortização)"). O grupo de
 * ações 144:12 tem 298×31 e TRÊS filhos, na ordem: 144:13 "Marcar Pago"
 * (102×31), 144:15 "Editar juros" (94×31) e 144:17 "Descartar" (86×31).
 * Nas linhas de Occurrence do MESMO frame (ex.: 10:34, 267×31) o grupo é
 * idêntico, só com "Editar" (63×31) no lugar de "Editar juros" — ou seja,
 * "Editar juros" substitui "Editar", nunca "Descartar".
 *
 * O diálogo é o do frame 34:2 estado ③ (nó 34:31): título 34:35
 * `Descartar "…" deste mês?`, corpo 34:36 "A série continua normalmente a
 * partir do mês seguinte.", botões 34:39 "Cancelar" e 34:41 "Descartar".
 */
const LIABILITY_ID = 'liab-1'

function renderScreen() {
  const month = todayMonth()
  const plannedDate = `${month}-10`

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  client.setQueryData(['occurrences', month], { data: [], meta: { total: 0 } })
  client.setQueryData(['recurrences', 'all'], { data: [], meta: { total: 0 } })
  client.setQueryData(['categories', 'all'], { data: [], meta: { total: 0 } })
  client.setQueryData(['statement-blocks'], { data: [], meta: { total: 0 } })
  client.setQueryData(['liabilities', 'all'], {
    data: [
      {
        id: LIABILITY_ID,
        name: 'Financiamento apartamento',
        creditor: 'Caixa Econômica',
        entity: 'PF',
        classification: 'NonCurrent',
        originalAmount: 32_000_000,
        installmentAmount: 152_000,
        installmentCount: 360,
        installmentsAlreadyPaid: 12,
        monthlyInterestRate: 0.008,
        startDate: todayIsoDate(),
      },
    ],
    meta: { total: 1 },
  })
  client.setQueryData(['liabilities', LIABILITY_ID, 'installments'], {
    data: [
      {
        id: `${LIABILITY_ID}#13`,
        liabilityId: LIABILITY_ID,
        number: 13,
        plannedDate,
        plannedAmount: 152_000,
        status: 'Planned',
        paidAmount: null,
        discarded: false,
      },
    ],
    meta: { total: 1 },
  })

  return render(
    <QueryClientProvider client={client}>
      <RecurrenceReviewScreen />
    </QueryClientProvider>,
  )
}

describe('Revisão de Recorrentes — linha de Parcela de Passivo (Figma 10:2, nó 144:6)', () => {
  it('Figma 144:12 — renderiza as TRÊS ações, na ordem Confirmar / Editar juros / Descartar ("Marcar Pago" virou "Confirmar", dono 2026-10-06)', async () => {
    renderScreen()

    const row = await screen.findByRole('listitem')
    const actions = within(row)
      .getAllByRole('button')
      .map((button) => button.textContent)

    expect(actions).toEqual(['Confirmar', 'Editar juros', 'Descartar'])
  })

  it('Figma 34:2 nós 34:35/34:36 — "Descartar" abre o diálogo com o texto literal do frame', async () => {
    const user = userEvent.setup()
    renderScreen()

    const row = await screen.findByRole('listitem')
    await user.click(within(row).getByRole('button', { name: 'Descartar' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Descartar "Financiamento apartamento, parcela 13/360" deste mês?'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('A série continua normalmente a partir do mês seguinte.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
  })
})

/**
 * O card da lista abria direto na tabela, sem cabeçalho. A Mockup desenha um:
 * `822:528` "Card / Recorrências do mês" → `822:529` "Cabeçalho do card"
 * (1088×74), com dois textos literais, `822:530` e `822:531` — medidos pelo
 * MCP. O Wireframe `10:2` também não tinha, e foi ele que o código copiou.
 */
describe('Revisão de Recorrentes — cabeçalho do card (Mockup 822:529)', () => {
  it('mostra o título e a legenda que o frame desenha, palavra por palavra', async () => {
    renderScreen()

    expect(await screen.findByText('Recorrências deste mês')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Lançamentos gerados automaticamente pelas suas recorrências e parcelas ativas.',
      ),
    ).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LiabilityDetailScreen } from './liability-detail-screen'

// O SegmentedControl do diálogo de edição é um RadioGroup do Radix, e o
// indicador dele mede o item já no primeiro render; o jsdom não tem
// ResizeObserver (mesmo stub de home-modals.test.tsx).
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

/**
 * Card "Parcelas" do Detalhe do Passivo.
 *
 * Fonte medida, não deduzida:
 *
 * WIREFRAME — docs/figma/frames/91-2__desktop-detalhe-do-passivo-analise-de-
 * divida.xml, card 337:3 ("Parcelas", título 91:99). As QUATRO linhas têm a
 * MESMA coluna de ação, só com rótulo diferente:
 *   - #11 Paga  (91:100): status 91:105 "Paga"     + botão 91:106 (56×25) com
 *                         o texto 91:107 "Editar"
 *   - #12 Paga  (91:108): status 91:113 "Paga"     + botão 91:114 (56×25) com
 *                         o texto 91:115 "Editar"
 *   - #13 Prev. (91:116): status 91:121 "Prevista" + botão 91:122 (91×25) com
 *                         o texto 91:123 "Marcar Paga"
 *   - #14 Prev. (91:124): idem, botão 91:130 (91×25) / texto 91:131
 *
 * MOCKUP — página 552:2, frame 948:1687 "Desktop — Detalhe do Passivo
 * (claro)", card 950:33. O botão da linha Paga SOBREVIVEU à camada visual, em
 * claro e escuro: instances "Botão" 950:42 e 950:51, ambas 71×44 em x=953,
 * contra 115×44 (950:60 / 950:69) nas linhas Previstas. As larguras confirmam
 * qual rótulo é qual: o label da linha Paga mede 39px contra 83px do da
 * Prevista ("Marcar Paga") — "Editar juros" seria MAIS largo que "Marcar
 * Paga", não caberia. Daí o literal do Wireframe, "Editar".
 */
const LIABILITY_ID = 'liab-1'

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })

  client.setQueryData(['liabilities', LIABILITY_ID], {
    id: LIABILITY_ID,
    name: 'Financiamento apartamento',
    creditor: 'Caixa Econômica',
    entity: 'PF',
    classification: 'NonCurrent',
    originalAmount: 32_000_000,
    installmentAmount: 152_000,
    installmentCount: 4,
    installmentsAlreadyPaid: 2,
    monthlyInterestRate: 0.0085,
    startDate: '2025-08-15',
  })

  client.setQueryData(['liabilities', LIABILITY_ID, 'installments'], {
    data: [
      {
        id: `${LIABILITY_ID}#11`,
        liabilityId: LIABILITY_ID,
        number: 11,
        plannedDate: '2026-06-10',
        plannedAmount: 152_000,
        status: 'Paid',
        paidAmount: 152_000,
        discarded: false,
      },
      {
        id: `${LIABILITY_ID}#12`,
        liabilityId: LIABILITY_ID,
        number: 12,
        plannedDate: '2026-07-10',
        plannedAmount: 152_000,
        status: 'Paid',
        paidAmount: 154_000,
        discarded: false,
      },
      {
        id: `${LIABILITY_ID}#13`,
        liabilityId: LIABILITY_ID,
        number: 13,
        plannedDate: '2026-08-10',
        plannedAmount: 152_000,
        status: 'Planned',
        paidAmount: null,
        discarded: false,
      },
      {
        id: `${LIABILITY_ID}#14`,
        liabilityId: LIABILITY_ID,
        number: 14,
        plannedDate: '2026-09-10',
        plannedAmount: 152_000,
        status: 'Planned',
        paidAmount: null,
        discarded: false,
      },
    ],
    meta: { total: 4 },
  })

  client.setQueryData(['trace-events', 'liability', LIABILITY_ID], {
    data: [],
    meta: { total: 0 },
  })

  return render(
    <QueryClientProvider client={client}>
      <LiabilityDetailScreen liabilityId={LIABILITY_ID} />
    </QueryClientProvider>,
  )
}

describe('Detalhe do Passivo — card "Parcelas" (Figma 91:2 nó 337:3 / Mockup 948:1687 nó 950:33)', () => {
  it('files_design/01 §12 / Figma 91:107 e 91:115 — a linha de parcela Paga tem a ação "Editar"', async () => {
    renderScreen()

    const rows = await screen.findAllByRole('listitem')
    const paidRow = rows.find((row) => row.textContent?.startsWith('#11'))!

    expect(within(paidRow).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })

  it('files_design/01 §12 e §11 — "Editar" na parcela Paga abre Registrar Reajuste de Juros', async () => {
    const user = userEvent.setup()
    renderScreen()

    const rows = await screen.findAllByRole('listitem')
    const paidRow = rows.find((row) => row.textContent?.startsWith('#12'))!

    await user.click(within(paidRow).getByRole('button', { name: 'Editar' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Registrar Reajuste de Juros')).toBeInTheDocument()
  })

  it('Figma 91:123 e 91:131 — a linha Prevista continua com "Marcar Paga"', async () => {
    renderScreen()

    const rows = await screen.findAllByRole('listitem')
    const plannedRow = rows.find((row) => row.textContent?.startsWith('#13'))!

    expect(within(plannedRow).getByRole('button', { name: 'Marcar Paga' })).toBeInTheDocument()
    expect(within(plannedRow).queryByRole('button', { name: 'Editar' })).toBeNull()
  })

  /**
   * Mockup 948:1687 (claro) / 952:1717 (escuro), card 950:33: a linha Paga
   * carrega uma instance "Etiqueta" (950:40 e 950:49, 47×22) — a MESMA classe
   * de componente das linhas Previstas (950:58 e 950:67, 72×22), só com o tipo
   * verde em vez do âmbar. Medido em get_design_context de 950:35: a etiqueta
   * "Paga" usa `--fundo-positivo-sutil` de fundo, `--texto-positivo` de texto e
   * `--raio-pilula` de raio — os mesmos três valores que tokens.css guarda em
   * `--color-bg-positive-subtle`, `--color-text-positive` e `--radius-pill`,
   * ou seja, exatamente `Badge tone="pago"`.
   *
   * A cláusula de files_design/07 "Hierarquia de cor" que manda 'Pago' em cinza
   * terciário está escopada em "Status na TABELA"; este card é uma lista de
   * linhas (950:35 "Linha"), e o Mockup desenha a pílula verde nela.
   */
  it('Mockup 950:40 — a linha Paga usa a Etiqueta verde, não texto cinza solto', async () => {
    renderScreen()

    const rows = await screen.findAllByRole('listitem')
    const paidRow = rows.find((row) => row.textContent?.startsWith('#11'))!

    const tag = within(paidRow).getByText('Paga')
    expect(tag).toHaveClass('bg-surface-positive')
    expect(tag).toHaveClass('text-ink-positive')
    expect(tag).toHaveClass('rounded-pill')
  })
})

/**
 * "Editar dados cadastrais" — botão `91:43` do grupo `203:2` (Wireframe `91:2`;
 * Mockup `948:1687`, instance `948:1839`).
 *
 * O Figma nomeia UM gatilho de recálculo do cronograma, e nomeia por escrito:
 * a legenda `91:98` sob o gráfico (Mockup `949:72`) diz "Recalculado a cada
 * reajuste de juros registrado" — a OUTRA ação do cabeçalho (`91:58` → `94:2`).
 * Logo este diálogo não pode oferecer as entradas de `buildInstallmentSchedule`:
 * com "Número de parcelas" editável, 360 → 400 imprimia "12 / 400 pagas" no
 * card `91:56` sobre a lista `337:3` de 360 linhas e o rodapé `91:132` ainda
 * contando sobre 360 (PERGUNTAS-EM-ABERTO P24).
 */
describe('Detalhe do Passivo — "Editar dados cadastrais" (Figma 91:2 nó 91:43)', () => {
  it('Figma 91:98 — não oferece os campos que dão forma ao cronograma', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Editar dados cadastrais' }))
    const dialog = await screen.findByRole('dialog')

    for (const label of [
      'Valor original da dívida',
      'Número de parcelas',
      'Parcelas já pagas',
      'Data de início',
    ]) {
      expect(within(dialog).queryByText(label)).toBeNull()
    }
  })

  it('edita o que não muda número nenhum: Nome, Credor / Instituição, Valor da parcela', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Editar dados cadastrais' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Nome')).toBeInTheDocument()
    expect(within(dialog).getByText('Credor / Instituição')).toBeInTheDocument()
    expect(within(dialog).getByText('Valor da parcela')).toBeInTheDocument()
  })

  // "Valor da parcela" estava num `grid-cols-3` de um diálogo `form`: 460 de
  // largura, menos os 24+24 de `px-24` do corpo, dá 412 úteis; com `gap-16`
  // entre três colunas sobram (412 − 32) / 3 = 126,67 por campo. E o teto do
  // produto, "R$ 999.000.000.000,00", mede 154 de texto e precisa de 180 com o
  // respiro de 12+12 do Campo (a mesma medição de `--width-field-money-dialog`
  // e de src/styles/money-field-width.test.ts). 126 cortava o número.
  //
  // O token não pegava este campo porque ele não usava token nenhum — era
  // célula de grade. É por isso que o teste olha a classe: é onde a largura
  // mora, e o jsdom não resolve layout pra medir em pixel.
  it('files_design/03 — "Valor da parcela" comporta o teto de R$ 999.000.000.000,00', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Editar dados cadastrais' }))
    const dialog = await screen.findByRole('dialog')

    const input = within(dialog).getByLabelText(/^Valor da parcela \*$/)
    expect(input.closest('[class*="width-field-money-dialog"]')).not.toBeNull()
  })

  // Visto no navegador, não deduzido: com a taxa em 0,05 o diálogo imprimia
  // "5" sob o rótulo "TAXA DE JUROS (A.M.)" — um número sem unidade. A causa é
  // que `formatPercentText` é o formato de DIGITAÇÃO (é o que alimenta
  // `monthlyInterestRateText` nos formulários e o placeholder do reajuste), e
  // por isso não carrega o "%". Quem formata para leitura é `formatMonthlyRate`,
  // que o card "Taxa de juros atual" desta mesma tela já usava.
  //
  // O " a.m." NÃO entra aqui, ao contrário do card: lá o rótulo é só "Taxa de
  // juros atual" e a unidade precisa vir no número; aqui o rótulo já diz
  // "(a.m.)" e repetir daria "0,85% a.m. (a.m.)".
  it('files_design/03 — a taxa é lida com a unidade: "0,85%", não "0,85"', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Editar dados cadastrais' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('0,85%')).toBeInTheDocument()
  })
})

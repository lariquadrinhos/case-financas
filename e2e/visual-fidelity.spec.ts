/**
 * Visual/textual fidelity e2e — every label asserted below is copied
 * word-for-word from a `docs/figma/frames/<node>.xml` text node (the node id
 * is named in each `test.describe`, so the claim is checkable: `cat
 * docs/figma/frames/<node>*.xml`), OR from the sidebar/empty-state catalogues
 * that are themselves extracted verbatim from the Figma
 * (`src/components/patterns/sidebar.tsx`, `empty-states.ts`).
 *
 * Against the REAL production server (`playwright.config.ts` builds and
 * starts it) and the seeded database (`npm run db:seed`) — a component whose
 * source comment claims a string still has to actually reach the rendered
 * accessibility tree, which is the one thing reading the `.tsx` file cannot
 * prove.
 *
 * Six screens, per the task: Home, Novo Lançamento, DRE, Histórico, Revisão
 * de Recorrentes, Onboarding 0.
 */

import { expect, test } from '@playwright/test'

/* -------------------------------------------------------------------------
 * Sidebar — present on every screen inside `(app)`, Figma node `5:3`.
 * Checked once here; every other describe below trusts it and moves on.
 * ---------------------------------------------------------------------- */

async function expectSidebarFidelity(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  // Marca "Bigorna" (glossário, 2026-10-01) — a Mockup escrevia "Finanças PF+PJ".
  await expect(nav.getByRole('link', { name: 'Bigorna' })).toBeVisible()
  await expect(nav.getByRole('link', { name: '+ Novo Lançamento' })).toBeVisible()

  // Redesenho de 2026-10-01 (pendente de design): os grupos recolhíveis da
  // Mockup 749:10/749:26 viraram títulos de seção fixos, e toda tela é um link
  // sempre visível — inclusive os cinco cadastros e "Início".
  for (const title of ['Relatórios', 'Lançamentos', 'Plano de Contas e Patrimônio']) {
    await expect(nav.getByRole('heading', { name: title, exact: true })).toBeVisible()
  }
  for (const linkLabel of [
    'DRE',
    'Balanço Patrimonial',
    'Evolução Mensal',
    'Indicadores Financeiros',
    'Revisão de Recorrentes',
    'Histórico',
    'Plano de Contas',
    'Contas Bancárias',
    'Bens Materiais',
    'Investimentos',
    'Passivos',
  ]) {
    await expect(nav.getByRole('link', { name: linkLabel, exact: true })).toBeVisible()
  }
}

/* -------------------------------------------------------------------------
 * Home — Figma `5:2`, card titles/captions from
 * `docs/figma/frames/5-2__desktop-inicio-dashboard.xml` (verbatim also in
 * `src/app/(app)/inicio/page.tsx` `CARD_META`, checked against the XML in the
 * exploration for this suite).
 * ---------------------------------------------------------------------- */

test.describe('Home (Figma 5:2) — textos literais', () => {
  test('a saudação, os 6 cards e suas legendas aparecem, palavra por palavra', async ({ page }) => {
    await page.goto('/inicio')
    await expectSidebarFidelity(page)

    // `greetingFor` (src/lib/greeting.ts) is time-of-day dependent — the <h1>
    // is exactly one of these three strings, never a 4th value or "Olá".
    await expect(
      page.getByRole('heading', { level: 1, name: /^(Bom dia|Boa tarde|Boa noite)$/ }),
    ).toBeVisible()

    await expect(page.getByRole('button', { name: 'Organizar Home' })).toBeVisible()

    const cards: readonly { title: string; caption: string }[] = [
      {
        title: 'Pendências',
        caption:
          'Coisas que precisam da sua decisão: valor sem destino, recorrência sem valor definido, ou lucro do mês ainda não distribuído.',
      },
      {
        title: 'Entradas e Saídas',
        caption:
          'De onde vem e pra onde vai o dinheiro no mês selecionado. Mês atual ou passado mostra fato; mês futuro mostra projeção.',
      },
      {
        title: 'Onde Está Meu Dinheiro',
        caption: 'Clique num bloco pra redirecionar dinheiro pra outro lugar, a qualquer momento.',
      },
      {
        title: 'Despesas por Categoria',
        caption: 'Clique na categoria para visualizar ou adicionar gastos.',
      },
      {
        title: 'Saldo para Consumo Livre',
        caption: 'Seu limite livre do mês, sem precisar lançar cada gasto.',
      },
      {
        title: 'Eventos Recentes',
        caption: 'Últimos 5: reajustes, divergências e parcelas confirmadas',
      },
    ]

    for (const card of cards) {
      await expect(page.getByRole('heading', { level: 2, name: card.title })).toBeVisible()
      await expect(page.getByText(card.caption, { exact: true })).toBeVisible()
    }
  })
})

/* -------------------------------------------------------------------------
 * Novo Lançamento — Figma `262:873` (aba Despesa), the fields the tab draws
 * (`6:44` "Valor *", `6:48` "Data de pagamento *", `6:52` "Status", `6:59`
 * "Entidade", `6:70` "Classificação (sugerida)", `6:84`/`6:86` the two
 * buttons) — confirmed against
 * docs/figma/frames/262-873__desktop-novo-lancamento-aba-despesa.xml.
 * ---------------------------------------------------------------------- */

test.describe('Novo Lançamento (Figma 262:873) — aba Despesa', () => {
  test('título, abas, campos e o texto de ajuda da Despesa aparecem literais', async ({ page }) => {
    await page.goto('/novo-lancamento')

    // Novo Lançamento é o diálogo `872:1305` / `6:29` — o título `872:1306`
    // é o nome acessível do próprio contêiner, não um `h1` de rota.
    await expect(page.getByRole('dialog', { name: 'Novo Lançamento' })).toBeVisible()

    // The 4 tabs, `TAB_LABEL` in novo-lancamento-screen.tsx.
    const tablist = page.getByRole('tablist')
    for (const tab of ['Despesa', 'Receita', 'Pró-labore e Distribuição', 'IR']) {
      await expect(tablist.getByRole('tab', { name: tab })).toBeVisible()
    }

    // Despesa is the tab that opens active — its helper text, word for word.
    await expect(
      page.getByText(
        'Despesa: qualquer gasto que saiu ou vai sair da sua conta, inclusive compra no crédito (marque Previsto até a fatura ser realmente paga).',
        { exact: true },
      ),
    ).toBeVisible()

    // The 4 required fields' `<label>` carries a trailing " *" as a same-label
    // `aria-hidden` span (`components/ui/input.tsx` `Label`) — a real, native
    // form control (input/textbox/combobox), so Playwright's `getByLabel`
    // resolves the CONTROL, not the `<label>` text, matching "Valor" without
    // ever needing the literal "Valor *".
    for (const label of ['Valor', 'Data de pagamento', 'Categoria', 'Conta']) {
      await expect(page.getByLabel(label)).toBeVisible()
    }
    // Status/Entidade/Classificação are `required={false}` (no asterisk to
    // strip) but sit on a Controle segmentado — a `role="radiogroup"` `<div>`,
    // which HTML does not let a `<label for>` name the way it names an
    // `<input>`, so `getByLabel` cannot resolve these three. Their `<label>`
    // text is exact and stands alone (its "Ajuda sobre …" tooltip button is a
    // SIBLING, `field.tsx`'s `labelExtra`, never inside the label itself), so
    // matching the label's own text directly is the reliable read here.
    for (const label of ['Status', 'Entidade', 'Classificação (sugerida)']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }

    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar Lançamento' })).toBeVisible()
  })
})

/* -------------------------------------------------------------------------
 * DRE — Figma `11:2`, confirmed against
 * docs/figma/frames/11-2__desktop-dre.xml (nodes 11:27, 239:2/3/11,
 * 239:6/8/10, 239:14/16, 290:2, 11:42 "Receita Bruta").
 * ---------------------------------------------------------------------- */

test.describe('DRE (Figma 11:2) — textos literais', () => {
  test('título, parágrafos de ajuda, seletores e ao menos uma linha da cascata', async ({
    page,
  }) => {
    await page.goto('/dre')

    await expect(page.getByRole('heading', { level: 1, name: 'DRE' })).toBeVisible()

    // As legendas do MOCKUP, não as do Wireframe. Este bloco afirmava as três
    // frases longas de `11:2` (`239:2`/`239:3`/`239:11`) e ficou vermelho no CI
    // quando a P41 fez o código seguir a fonte visual vigente (ADR-0015): o
    // Mockup não omitiu a ajuda do Wireframe, ele a REESCREVEU, condensando os
    // três parágrafos — a mesma decisão que files_design/07 já registrava.
    for (const sentence of [
      'Como a receita do mês vira lucro, linha a linha.',
      'Navegue entre meses: pra trás revê o resultado real de meses passados; pra frente mostra a projeção baseada em recorrências e parcelas já configuradas.',
    ]) {
      await expect(page.getByText(sentence)).toBeVisible()
    }

    const viewSwitch = page.getByRole('radiogroup', { name: 'Visão' })
    for (const option of ['Consolidado', 'PF', 'PJ']) {
      await expect(viewSwitch.getByRole('radio', { name: option })).toBeVisible()
    }
    const statusSwitch = page.getByRole('radiogroup', { name: 'Status' })
    for (const option of ['Pago', 'Previsto']) {
      await expect(statusSwitch.getByRole('radio', { name: option })).toBeVisible()
    }

    await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeVisible()

    // The cascade always renders its 13 structural lines (amounts may be
    // zero), regardless of which month "hoje" happens to be — `Receita
    // Bruta` is the very first one, Figma node `11:42`.
    await expect(page.getByRole('cell', { name: 'Receita Bruta', exact: true })).toBeVisible()
  })
})

/* -------------------------------------------------------------------------
 * Histórico — Figma `9:2`, confirmed against
 * docs/figma/frames/9-2__desktop-historico.xml.
 * ---------------------------------------------------------------------- */

test.describe('Histórico (Figma 9:2) — textos literais', () => {
  test('título, parágrafos, filtros e cabeçalho da tabela aparecem literais', async ({ page }) => {
    await page.goto('/historico')

    await expect(page.getByRole('heading', { level: 1, name: 'Histórico' })).toBeVisible()
    await expect(
      page.getByText('Histórico: todos os lançamentos já registrados, de qualquer tipo.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText('Use os filtros pra encontrar rapidamente o que precisa.', { exact: true }),
    ).toBeVisible()

    for (const filterLabel of [
      'Status',
      'Entidade',
      'Mês',
      'Categoria',
      'Classificação',
      'Conta',
      'Recorrência',
    ]) {
      await expect(page.getByLabel(filterLabel, { exact: true })).toBeVisible()
    }

    const table = page.getByRole('table')
    for (const header of ['Data', 'Lançamento', 'Entidade', 'Conta', 'Status', 'Valor']) {
      await expect(table.getByRole('columnheader', { name: header })).toBeVisible()
    }
  })
})

/* -------------------------------------------------------------------------
 * Revisão de Recorrentes — Figma `10:2`, confirmed against
 * docs/figma/frames/10-2__desktop-revisao-de-recorrentes.xml.
 * ---------------------------------------------------------------------- */

test.describe('Revisão de Recorrentes (Figma 10:2) — textos literais', () => {
  test('título e os dois parágrafos de ajuda aparecem literais', async ({ page }) => {
    await page.goto('/revisao-de-recorrentes')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Revisão de Recorrentes' }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Revisão de Recorrentes: os lançamentos que suas recorrências já geraram como Previsto pra este mês. Para cada um, marque como pago, edite o valor ou descarte só esta ocorrência.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Navegue entre meses: pra trás revê recorrências de meses passados; pra frente mostra o que já está projetado pros próximos meses.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeVisible()
  })
})

/* -------------------------------------------------------------------------
 * Onboarding 0 — Figma `116:2`, confirmed against
 * docs/figma/frames/116-2__onboarding-0-antes-de-comecar.xml (nodes 116:4,
 * 116:6/7/8, 116:11/116:13) — this screen has no sidebar (`src/app/onboarding/layout.tsx`).
 * ---------------------------------------------------------------------- */

test.describe('Onboarding 0 (Figma 116:2) — textos literais', () => {
  test('título, os três parágrafos e os dois botões de saída aparecem literais', async ({
    page,
  }) => {
    await page.goto('/onboarding')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Antes de começar, vamos configurar seu Plano de Contas e Patrimônio',
      }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Esta etapa registra sua situação atual: contas, bens, investimentos e dívidas.',
        {
          exact: true,
        },
      ),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Dá pra fazer isso depois, mas configurar agora deixa seus relatórios certos desde o primeiro dia.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Lançamentos e recorrências não fazem parte desta etapa. Registre suas transações como salário e gastos do dia a dia em Novo Lançamento.',
        { exact: true },
      ),
    ).toBeVisible()

    // Botões, não links: cada um é um EVENTO no Wireframe — "Fazer depois"
    // (116:11) grava a desistência para que a abertura do app respeite
    // "pula pra Home" (files_design/01 §2) na visita seguinte, e "Começar
    // agora" (116:13) grava a entrada no passo 1. Ver
    // src/features/onboarding/actions.ts.
    await expect(page.getByRole('button', { name: 'Fazer depois' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Começar agora' })).toBeVisible()
  })
})

/* -------------------------------------------------------------------------
 * P42 — a ORDEM de leitura, o que a auditoria de texto não pega
 *
 * A varredura cruzada de 2026-09-08 comparou 177 termos das 32 telas: pega
 * vocabulário trocado, rótulo ausente e erro de digitação. Não pega ordem,
 * agrupamento, espaçamento, alinhamento nem divisória.
 *
 * Decidido em 2026-09-09: só a ORDEM é automatizada — ela é mecânica e não
 * depende de pixel, e por isso não quebra porque o app é fluido e o Mockup é
 * fixo em 1440. O resto continua sendo olho humano, e o checklist de tela diz.
 *
 * As cinco telas de relatório têm a mesma asserção em jsdom, onde elas já
 * renderizam inteiras (`src/app/(app)/*​/page.test.tsx`). Aqui ficam as três que
 * só existem no servidor de verdade.
 * ---------------------------------------------------------------------- */

async function expectReadingOrder(
  page: import('@playwright/test').Page,
  entries: readonly { label: string; locator: import('@playwright/test').Locator }[],
) {
  const handles = []
  for (const entry of entries) {
    await expect(entry.locator.first()).toBeVisible()
    handles.push(await entry.locator.first().elementHandle())
  }
  for (let i = 1; i < handles.length; i += 1) {
    const isAfter = await page.evaluate(
      ([previous, current]) =>
        (previous!.compareDocumentPosition(current!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      [handles[i - 1], handles[i]],
    )
    expect(
      isAfter,
      `"${entries[i]?.label}" tem que vir depois de "${entries[i - 1]?.label}" (frame do Figma)`,
    ).toBe(true)
  }
}

test.describe('Ordem de leitura (P42)', () => {
  test('Home (5:2) — os seis cards na ordem padrão do PRD', async ({ page }) => {
    await page.goto('/inicio')
    // PRD §"Home (novo na v7)": "seis cards em ordem padrão".
    const titles = [
      'Pendências',
      'Entradas e Saídas',
      'Onde Está Meu Dinheiro',
      'Despesas por Categoria',
      'Saldo para Consumo Livre',
      'Eventos Recentes',
    ]
    await expectReadingOrder(
      page,
      titles.map((title) => ({
        label: title,
        locator: page.getByRole('heading', { level: 2, name: title, exact: true }),
      })),
    )
  })

  test('Novo Lançamento (262:873) — as quatro abas na ordem desenhada', async ({ page }) => {
    await page.goto('/novo-lancamento')
    const tablist = page.getByRole('tablist')
    await expect(tablist).toBeVisible()
    // `TAB_LABEL` em novo-lancamento-screen.tsx, na ordem do frame.
    expect((await tablist.getByRole('tab').allTextContents()).map((t) => t.trim())).toEqual([
      'Despesa',
      'Receita',
      'Pró-labore e Distribuição',
      'IR',
    ])
  })

  test('Revisão de Recorrentes (10:2) — título, navegação de mês e a lista', async ({ page }) => {
    await page.goto('/revisao-de-recorrentes')
    await expectReadingOrder(page, [
      {
        label: 'título',
        locator: page.getByRole('heading', { level: 1, name: 'Revisão de Recorrentes' }),
      },
      { label: 'navegação de mês', locator: page.getByRole('button', { name: 'Mês anterior' }) },
      { label: 'primeira ocorrência', locator: page.getByRole('button', { name: 'Marcar Pago' }) },
    ])
  })
})

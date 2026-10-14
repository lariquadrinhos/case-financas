import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from './sidebar'

function renderSidebar() {
  return render(<Sidebar />)
}

/**
 * files_design/07, "Barra lateral", regra 11: o item ativo da navegação muda
 * em pelo menos DUAS propriedades independentes — cor (fundo `bg/state-subtle`
 * + texto `text/state`) E peso da fonte (`body.md-medium`, não `body.md`).
 * Trocar só a cor e esquecer o peso da fonte é o erro que a regra existe pra
 * prevenir: "sutil o bastante pra passar numa checagem rápida".
 *
 * Esta é uma das duas inversões verificadas do grupo Sidebar + Home: a
 * variante `font-medium` foi removida de propósito uma vez (ver histórico de
 * edição), o teste ficou vermelho, e a classe foi restaurada.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/dre',
}))

describe('Sidebar — item ativo (files_design/07, densidade #11)', () => {
  it('marca o item ativo com fundo/cor de estado E peso de fonte, nunca só um dos dois', () => {
    renderSidebar()

    const activeItem = screen.getByRole('link', { name: 'DRE' })

    // Propriedade 1: cor (fundo + texto de estado).
    expect(activeItem.className).toContain('bg-surface-state')
    expect(activeItem.className).toContain('text-ink-state')

    // Propriedade 2, independente da primeira: peso da fonte.
    expect(activeItem.className).toContain('font-medium')
  })

  // Relato de 2026-10-01: "ao clicar em novo lançamento… ele tá direcionando
  // para uma tela diferente da que eu tava". Sem `from`, o formulário voltava
  // sempre para o Início.
  it('"+ Novo Lançamento" leva a tela atual, para o formulário voltar a ela', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: '+ Novo Lançamento' }).getAttribute('href')).toBe(
      '/novo-lancamento?from=dre',
    )
  })

  it('não marca um item inativo com nenhuma das duas propriedades', () => {
    renderSidebar()

    const inactiveItem = screen.getByRole('link', { name: 'Balanço Patrimonial' })

    expect(inactiveItem.className).not.toContain('bg-surface-state')
    expect(inactiveItem.className).not.toContain('font-medium')
  })
})

/**
 * Redesenho de 2026-10-01 (pedido do dono: "está ruim e pouco acessível, com
 * muitos cliques e com scroll"; "seja criativo"). Substitui os grupos
 * recolhíveis de files_design/01 §0 e 07: toda tela a UM clique, "Início"
 * explícito, barra fixa na tela e o tema no rodapé. 🟩 pendente de design.
 */
describe('Sidebar — redesenho de 2026-10-01: tudo a um clique', () => {
  const SCREENS = [
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
  ]

  it('as 11 telas são links visíveis sem nenhum clique, e não há grupo que abre e fecha', () => {
    renderSidebar()
    for (const name of SCREENS) {
      expect(screen.getByRole('link', { name })).toBeVisible()
    }
    expect(
      screen.queryByRole('button', { name: /Relatórios|Plano de Contas e Patrimônio/ }),
    ).toBeNull()
  })

  // "Remove o Início. O logo já seria o início" (dono, 2026-10-01).
  it('não há item "Início": a marca é o caminho para a Home', () => {
    renderSidebar()
    expect(screen.queryByRole('link', { name: 'Início' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Bigorna' }).getAttribute('href')).toBe('/inicio')
  })

  // "Precisa estar claro que não é clicável" (dono, 2026-10-01): o título se
  // distingue do item pela FORMA — rótulo pequeno, caixa alta, cor terciária,
  // sem hover — e não pelo peso, que o fazia parecer um item em negrito.
  it('os títulos de seção são rótulos, não itens: label-xs em caixa alta, cor terciária, sem hover, com divisória acima', () => {
    renderSidebar()
    const title = screen.getByText('Lançamentos')
    expect(title.className).toContain('text-style-label-xs')
    expect(title.className).toContain('uppercase')
    expect(title.className).not.toContain('text-style-body-md')
    expect(title.className).not.toContain('hover:')
    expect(title.closest('button, a')).toBeNull()
    expect(title.closest('section')?.className).toContain('border-t')
  })

  it('o alternador de tema fica na mesma linha da marca, no topo', () => {
    renderSidebar()
    const brand = screen.getByRole('link', { name: 'Bigorna' })
    const toggle = screen.getByRole('group', { name: /tema/i })
    expect(brand.parentElement).toBe(toggle.parentElement)
    expect(screen.queryByText('Tema')).toBeNull()
  })

  it('as seções "Relatórios", "Lançamentos" e "Plano de Contas e Patrimônio" são títulos, não controles', () => {
    renderSidebar()
    for (const title of ['Relatórios', 'Lançamentos', 'Plano de Contas e Patrimônio']) {
      const heading = screen.getByText(title)
      expect(heading.closest('button, a')).toBeNull()
    }
  })

  it('a barra fica fixa na tela enquanto o conteúdo rola', () => {
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(nav.className).toContain('sticky')
    expect(nav.className).toContain('h-screen')
  })

  it('a linha de item usa a altura compacta (32), para as 12 telas caberem sem scroll', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'DRE' }).className).toContain(
      'h-[var(--height-control)]',
    )
  })
})

// Marca (2026-10-01, pedido do dono: "vamos colocar um logo no Bigorna"): a
// bigorna de ferreiro — o nome do repositório — ao lado do nome do produto.
describe('Sidebar — logo', () => {
  it('a marca tem o logo (SVG decorativo) e o nome do link é "Bigorna" (glossário, 2026-10-01)', () => {
    renderSidebar()
    const brand = screen.getByRole('link', { name: 'Bigorna' })
    const logo = brand.querySelector('svg')
    expect(logo).not.toBeNull()
    expect(logo).toHaveAttribute('aria-hidden', 'true')
  })
})

/**
 * Geometria da Barra lateral — medida na página Mockup, que é quem arbitra a
 * camada visual (ADR-0015).
 *
 * O DEFEITO que este teste trava: `--width-sidebar: 278px` citava
 * `frame 5:3 / 26:26`, dois nós da página **Wireframe**. O Wireframe de fato
 * mede 278 — varredura dos 130 XML de `docs/figma/frames/`,
 * `grep -c 'name="Sidebar"'` = 44 ocorrências, TODAS com `width="278"` — mas
 * largura é camada visual, e aí quem vale é a Mockup. Os dois nós
 * "Barra lateral" da Mockup, medidos por MCP, dão 272:
 *   936:1544 (Plano de Contas)   width=272, filhos em x=16 com width=240
 *   749:2    (Início dashboard)  width=272, filhos em x=16 com width=240
 *
 * O erro era solidário: com `px-20` (o padding do Wireframe) a coluna útil
 * fechava em 278 − 40 = 238, e corrigir só a largura para 272 sem tocar no
 * padding daria 272 − 40 = 232 — erraria os 240 do Mockup por 8px. Por isso o
 * teste amarra os três números na mesma aritmética: 16 + 240 + 16 = 272.
 */
describe('Sidebar — geometria (Mockup 936:1544 e 749:2, ADR-0015)', () => {
  const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')
  // Montado a partir do número para não deixar um literal de medida no
  // componente — `make audit-tokens` (ADR-0011 §3) reprova o literal cru.
  const SIDEBAR_WIDTH = 272
  const NAV_CONTENT_WIDTH = 240

  it('Mockup 936:1544 / 749:2 — a barra lateral mede 272 de largura, não os 278 do Wireframe', () => {
    expect(tokensCss).toMatch(new RegExp(`--width-sidebar:\\s*${SIDEBAR_WIDTH}px;`))
  })

  it('Mockup 936:1545 / 749:3 — o padding lateral é 16, para a coluna útil fechar em 240', () => {
    renderSidebar()

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })

    expect(nav.className).toContain('w-[var(--width-sidebar)]')
    expect(nav.className).toContain('px-16')
    // 20 é o padding do Wireframe (frame 5:3); a Mockup usa 16.
    expect(nav.className).not.toContain('px-20')
  })

  it('Mockup 936:1544 — 16 + 240 + 16 = 272: a caixa de conteúdo da nav mede 240', () => {
    renderSidebar()

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    const padding = Number(/\bpx-(\d+)\b/.exec(nav.className)?.[1])
    const width = Number(/--width-sidebar:\s*(\d+)px;/.exec(tokensCss)?.[1])

    expect(width).toBe(SIDEBAR_WIDTH)
    expect(width - padding * 2).toBe(NAV_CONTENT_WIDTH)
  })
})

/**
 * Superfície da barra lateral — Figma, página Mockup, nós 549:44 "Desktop -
 * Início dashboard (claro)" e 738:258 "(escuro)", ambos 1440x2790. Cada um tem
 * dois filhos diretos: a "Barra lateral" (749:2 no claro, 749:85 no escuro) em
 * x=0 w=272, e o frame de conteúdo (549:70) em x=272 w=1168.
 *
 * MEDIÇÃO (render 1:1 de cada nó, amostragem de pixel):
 *   claro  — barra em (5,1500) e (260,1500) = #ffffff  (= --color-bg-card)
 *            conteúdo em (300,1500) e (1430,1500) = #f7f8f8 (= --color-bg-canvas)
 *            divisória em (271,1500) = #e6e8ea (= --color-border-default)
 *   escuro — barra #161b21, conteúdo #0e1216, divisória #262e36, os mesmos três
 *            tokens no outro tema.
 *
 * Ou seja: a barra lateral é uma superfície ELEVADA sobre o canvas, não a mesma
 * superfície do conteúdo. Isso já regrediu uma vez — as duas usavam
 * `bg-surface-canvas` "porque o XML dos frames não carrega fills" (P30, hoje
 * respondida). A inspeção por variáveis também engana: `get_variable_defs` em
 * 749:2 devolve `--superficie-card` por causa do polegar do alternador de tema
 * (749:6), não por causa do fundo do frame. Só a amostragem de pixel decide, e
 * é ela que este teste tranca.
 */
describe('Sidebar — superfície (Mockup 549:44 claro / 738:258 escuro)', () => {
  const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

  it('Mockup 549:44 / 738:258 — a barra lateral usa a superfície de card, não o canvas do conteúdo', () => {
    renderSidebar()

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })

    expect(nav.className).toContain('bg-surface-card')
    expect(nav.className).not.toContain('bg-surface-canvas')
  })

  it('Mockup 549:44 / 738:258 — a divisória entre barra e conteúdo é border-line-default à direita', () => {
    renderSidebar()

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })

    expect(nav.className).toContain('border-r')
    expect(nav.className).toContain('border-line-default')
  })

  it('card e canvas são superfícies distintas em TODOS os temas de tokens.css', () => {
    const valuesOf = (variable: string) =>
      [...tokensCss.matchAll(new RegExp(`--color-bg-${variable}:\\s*([^;]+);`, 'g'))].map((match) =>
        String(match[1]).trim(),
      )

    const cards = valuesOf('card')
    const canvases = valuesOf('canvas')

    expect(cards).toHaveLength(canvases.length)
    expect(cards.length).toBeGreaterThan(0)
    // Se um dia forem iguais, a medição acima deixa de ser reproduzível e a
    // barra lateral some visualmente sobre o conteúdo.
    cards.forEach((card, index) => expect(card).not.toBe(canvases[index]))
  })
})

// Os testes do chevron dos grupos (Mockup 749:12 / 749:28) e da linha de 36
// saíram em 2026-10-01: o redesenho trocou os grupos recolhíveis por seções
// fixas e a linha por 32. Ver "redesenho de 2026-10-01" acima.

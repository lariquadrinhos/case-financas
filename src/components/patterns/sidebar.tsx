'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './theme-toggle'
import { BigornaMark } from '@/components/ui/logo'
import { cn } from '@/lib/cn'

/**
 * Sidebar — "Barra lateral" na Mockup (nós 936:1544 e 749:2), 272px de largura
 * fixa, presente em toda tela. O padding lateral é 16 porque os filhos dos dois
 * nós ficam em x=16 com width=240: 16 + 240 + 16 = 272. O Wireframe (nós 5:3 /
 * 26:26) desenha 278/20/238, mas geometria é camada visual e aí a Mockup
 * arbitra (ADR-0015).
 *
 * The frame draws: product name + theme toggle, "+ Novo Lançamento" as the only
 * emphasised action, then the navigation with two collapsible groups
 * ("Relatórios" 749:10, "Plano de Contas e Patrimônio" 749:26) and no "Início"
 * item (the product name was the way home).
 *
 * REDESIGNED on 2026-10-01 (owner: "está ruim e pouco acessível, com muitos
 * cliques e com scroll"; "seja criativo") — 🟩 pendente de design, documented
 * in files_design/01 §0: the groups became fixed section titles (every screen
 * one click away), the bar is sticky, rows are 32 high, and the brand ("Bigorna"
 * + logo) is the way home — the owner dropped an explicit "Início" item and kept
 * the theme toggle beside the brand.
 *
 * Labels are copied word for word from the Figma. The glossary was argued and
 * closed; renaming anything here means changing files_design/04 first.
 *
 * Background is `bg-surface-card` (solid), not the content area's canvas —
 * Figma, página Mockup, nós 549:44 "Desktop - Início dashboard (claro)" e
 * 738:258 "(escuro)". Medido por amostragem de pixel no render 1:1 de cada nó:
 * a barra lateral rende #ffffff no claro e #161b21 no escuro (= color/bg/card),
 * enquanto a área de conteúdo (549:70, x=272 w=1168) rende #f7f8f8 / #0e1216
 * (= color/bg/canvas); a divisória entre as duas é #e6e8ea / #262e36
 * (= color/border/default), daí o `border-r border-line-default`.
 *
 * Não confie em `get_variable_defs` aqui: em 749:2 ele devolve
 * `--superficie-card` por causa do polegar do alternador de tema (749:6), não
 * do fundo do frame. Só o pixel decide. Trancado por sidebar.test.tsx,
 * "Sidebar — superfície".
 */

type NavItem = { label: string; href: string }
/**
 * Uma seção é um TÍTULO, não um controle (redesenho de 2026-10-01). Antes,
 * "Relatórios" e "Plano de Contas e Patrimônio" eram grupos recolhíveis com
 * defaults diferentes (files_design/01 §0); o segundo nascia fechado e cada
 * cadastro custava um clique a mais. Pedido do dono: "está ruim e pouco
 * acessível, com muitos cliques e com scroll". Agora toda tela está a um
 * clique, sempre. Os títulos são nomes do glossário (files_design/04):
 * "Relatórios", "Lançamentos" e "Plano de Contas e Patrimônio".
 */
type NavSection = { title: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  {
    title: 'Relatórios',
    items: [
      { label: 'DRE', href: '/dre' },
      { label: 'Balanço Patrimonial', href: '/balanco-patrimonial' },
      { label: 'Evolução Mensal', href: '/evolucao-mensal' },
      { label: 'Indicadores Financeiros', href: '/indicadores-financeiros' },
    ],
  },
  {
    title: 'Lançamentos',
    items: [
      { label: 'Revisão de Recorrentes', href: '/revisao-de-recorrentes' },
      { label: 'Histórico', href: '/historico' },
    ],
  },
  {
    title: 'Plano de Contas e Patrimônio',
    items: [
      { label: 'Plano de Contas', href: '/plano-de-contas' },
      { label: 'Contas Bancárias', href: '/contas-bancarias' },
      { label: 'Bens Materiais', href: '/bens-materiais' },
      { label: 'Investimentos', href: '/investimentos' },
      { label: 'Passivos', href: '/passivos' },
    ],
  },
]

// Linha compacta: `--height-control` (32), não os 36 da Mockup 749:2. Com
// "Início" explícito e as 12 telas sempre à vista, 36 por linha estourava uma
// janela de 768 de altura e trazia o scroll que o redesenho existe para tirar.
// Diverge do Figma; pendente de design.
const itemStyles =
  'flex h-[var(--height-control)] items-center rounded-control px-8 text-style-body-md text-ink-primary ' +
  'transition-colors hover:bg-surface-hover'

// files_design/07, Barra lateral: "Item ativo usa color/bg/state-subtle +
// color/text/state" — and densidade #11: at least 2 independent properties
// change (colour AND weight), never colour alone.
const activeItemStyles = 'bg-surface-state font-medium text-ink-state hover:bg-surface-state'

/**
 * O formulário volta para a tela de onde foi aberto (relato de 2026-10-01).
 * Só o primeiro trecho do caminho: `/passivos/{id}` volta para Passivos. Um
 * trecho que não é origem conhecida cai no Início, no próprio formulário.
 */
function newEntryHref(pathname: string | null): string {
  const screen = (pathname ?? '').split('/')[1] ?? ''
  return screen === '' || screen === 'novo-lancamento'
    ? '/novo-lancamento'
    : `/novo-lancamento?from=${screen}`
}

/** A tela atual é a do item, ou uma página dentro dela (`/passivos/{id}` acende Passivos). */
function isCurrent(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname ?? '').startsWith(`${href}/`)
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    // `sticky top-0 h-screen`: a barra fica na tela enquanto o conteúdo rola
    // (2026-10-01 — antes ela rolava junto e o "+ Novo Lançamento" sumia numa
    // tela longa). Com `overflow-y-auto`, numa janela mais baixa que a lista,
    // é a barra que rola, não a página.
    <nav
      aria-label="Navegação principal"
      className={cn(
        'sticky top-0 flex h-screen w-[var(--width-sidebar)] shrink-0 flex-col gap-20 overflow-y-auto',
        'border-r border-line-default bg-surface-card px-16 py-[var(--space-24)]',
      )}
    >
      {/* Marca + tema na mesma linha (dono, 2026-10-01: "coloque isso ao lado do
          logo"). A marca É o Início — não há item "Início" na lista. */}
      <div className="flex items-center justify-between gap-8">
        <Link
          href="/inicio"
          aria-current={isCurrent(pathname, '/inicio') ? 'page' : undefined}
          className="flex items-center gap-8 rounded-control text-style-heading-sm text-ink-primary hover:opacity-80"
        >
          <BigornaMark className="shrink-0" />
          Bigorna
        </Link>
        <ThemeToggle />
      </div>

      <Link
        href={newEntryHref(pathname)}
        className={cn(
          'flex h-[var(--height-button)] shrink-0 items-center justify-center rounded-control',
          'bg-surface-inverse text-style-body-md font-medium text-ink-inverse hover:opacity-[0.92]',
        )}
      >
        + Novo Lançamento
      </Link>

      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <NavSectionList key={section.title} section={section} pathname={pathname} />
        ))}
      </div>
    </nav>
  )
}

function NavSectionList({ section, pathname }: { section: NavSection; pathname: string | null }) {
  const containsCurrent = section.items.some((item) => isCurrent(pathname, item.href))
  return (
    // O título é um RÓTULO, e precisa parecer um (dono, 2026-10-01: "precisa
    // estar claro que não é clicável"): label-xs em caixa alta, cor terciária,
    // sem hover nem mãozinha, com divisória e ar acima. Em peso médio e no
    // tamanho do item ele parecia um item em negrito. O título da seção que
    // contém a tela atual acende na cor de estado: diz onde a pessoa está.
    <section
      aria-label={section.title}
      className="flex flex-col gap-4 border-t border-line-default pt-16"
    >
      <h2
        className={cn(
          'px-8 pb-4 text-style-label-xs uppercase',
          containsCurrent ? 'text-ink-state' : 'text-ink-tertiary',
        )}
      >
        {section.title}
      </h2>
      <ul className="flex flex-col gap-4">
        {section.items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </section>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const current = isCurrent(pathname, item.href)
  return (
    <li>
      <Link
        href={item.href}
        aria-current={current ? 'page' : undefined}
        className={cn(itemStyles, current && activeItemStyles)}
      >
        {item.label}
      </Link>
    </li>
  )
}

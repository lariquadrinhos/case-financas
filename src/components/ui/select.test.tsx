import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from './input'
import { Select, SelectContent, SelectEmpty, SelectItem, SelectTrigger } from './select'

/**
 * O campo de referência ("Conta *", "Investimento", "Passivo") É desenhado.
 *
 * Página Mockup, `872:1305` "Modal — Novo Lançamento": o campo Conta é o nó
 * `877:19`, e o Figma o reporta como `<instance name="Campo">`, 432×64 — a
 * MESMA instância de Campo que Valor (`872:1359`), Data de pagamento
 * (`872:1363`) e Categoria (`877:3`) usam. Internos: rótulo 432×18 em y=0,
 * caixa 432×40 em y=24, texto em x=12/y=10. O screenshot renderizado de
 * `877:19` mostra "Selecionar conta…" numa caixa SEM nenhum glifo à direita.
 *
 * Página Wireframe, `262:873` (docs/figma/frames/262-873__…despesa.xml): o
 * mesmo campo é `6:78`, 424×40, texto `6:79` "Selecionar conta…" em x=14/y=12,
 * também sem glifo — enquanto o campo Data de pagamento ao lado (`6:49`,
 * 424×42) CARREGA o ícone de calendário `201:2`, 18×18, em x=392. A ausência
 * de ícone em `6:78` é desenho deliberado, não omissão do wireframe.
 */

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
// O Radix Select usa pointer capture e `scrollIntoView`, que o jsdom não
// implementa — sem estes stubs o dropdown nem abre (mesmo recipe de
// vender-bem-material-dialog.direcionamento-receita.test.tsx).
Element.prototype.scrollIntoView = () => {}
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

function classesOf(element: Element): Set<string> {
  return new Set(element.getAttribute('class')?.split(/\s+/).filter(Boolean) ?? [])
}

describe('SelectTrigger — Mockup 877:19 (instância de Campo)', () => {
  it('Figma 877:19 / 6:78 — não desenha ícone nenhum no gatilho', () => {
    render(
      <Select>
        <SelectTrigger placeholder="Selecionar conta…" />
      </Select>,
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger.querySelectorAll('svg')).toHaveLength(0)
  })

  it('Figma 877:19 — o gatilho é o Campo: herda a geometria do controle, sem redesenhá-la', () => {
    const { container } = render(
      <>
        <Input />
        <Select>
          <SelectTrigger placeholder="Selecionar conta…" />
        </Select>
      </>,
    )

    const field = container.querySelector('input')
    if (field === null) throw new Error('Input não renderizou')
    const trigger = screen.getByRole('combobox')
    const triggerClasses = classesOf(trigger)

    // Toda classe de geometria/estado do Campo tem que estar no gatilho: se as
    // duas listas divergem, `field/focus` e `field/error` (`460:7` / `460:11`)
    // deixam de valer para o Select.
    for (const cls of classesOf(field)) {
      expect(triggerClasses, `classe do Campo ausente no gatilho: ${cls}`).toContain(cls)
    }
    // `877:19` tem um único filho de texto, alinhado à esquerda em x=12. Não há
    // segundo elemento à direita para `justify-between` empurrar.
    expect(triggerClasses).not.toContain('justify-between')
  })
})

describe('Lista aberta — geometria emprestada do Wireframe 47:2 (`83:4`)', () => {
  it('Figma 83:11 — a linha da lista mede --height-dropdown-row (29), não --height-control (32)', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger placeholder="Selecionar conta…" />
        <SelectContent>
          <SelectItem value="conta-sintetica-1">Conta Sintética</SelectItem>
        </SelectContent>
      </Select>,
    )

    const option = screen.getByRole('option', { name: 'Conta Sintética' })
    expect(classesOf(option)).toContain('h-[var(--height-dropdown-row)]')
  })

  it('Figma 83:10 — a lista rola em --height-dropdown-max (174), medida do frame', () => {
    const { baseElement } = render(
      <Select defaultOpen>
        <SelectTrigger placeholder="Selecionar conta…" />
        <SelectContent>
          <SelectItem value="conta-sintetica-1">Conta Sintética</SelectItem>
        </SelectContent>
      </Select>,
    )

    const scroller = baseElement.querySelector('[class*="height-dropdown-max"]')
    expect(scroller).not.toBeNull()
  })

  it('Figma 47:22 — a linha vazia mede --height-dropdown-empty (31), com o inset do Campo', () => {
    const { container } = render(<SelectEmpty>Nenhuma conta cadastrada.</SelectEmpty>)

    const empty = container.firstElementChild
    if (empty === null) throw new Error('SelectEmpty não renderizou')
    expect(classesOf(empty)).toContain('h-[var(--height-dropdown-empty)]')
    expect(classesOf(empty)).toContain('px-12')
  })

  it('bug de 2026-09-29 — rótulo longo fica numa linha só, com reticências e o texto inteiro no title', () => {
    const longo = 'Paga por Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)'
    render(
      <Select open value="a">
        <SelectTrigger />
        <SelectContent>
          <SelectItem value="a">{longo}</SelectItem>
        </SelectContent>
      </Select>,
    )
    const opcao = screen.getByRole('option', { name: longo })
    const wrapper = opcao.querySelector('span[title]')
    expect(wrapper?.getAttribute('title')).toBe(longo)
    expect(classesOf(wrapper!)).toContain('truncate')
    const valor = screen.getByRole('combobox', { hidden: true }).querySelector('span.truncate')
    expect(valor).not.toBeNull()
  })
})

describe('Select — hover (2026-10-01)', () => {
  it('o gatilho muda o fundo no hover, como os outros controles', async () => {
    const { SelectTrigger, Select } = await import('./select')
    const { render, screen } = await import('@testing-library/react')
    render(
      <Select>
        <SelectTrigger aria-label="Gatilho" />
      </Select>,
    )
    expect(screen.getByRole('combobox', { name: 'Gatilho' }).className).toContain(
      'hover:bg-surface-hover',
    )
  })
})

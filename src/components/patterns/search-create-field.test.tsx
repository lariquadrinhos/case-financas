import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchCreateField } from './search-create-field'

/**
 * Fidelidade do dropdown de "Buscar e Criar" ao Wireframe `47:2`
 * "Estado — Buscar/Criar Categoria (expandido)", painel ② (`83:2`), o ÚNICO
 * frame do arquivo que desenha este popover aberto — a página Mockup (`552:2`)
 * não tem nenhum: a varredura dos 13.894 nós dela por MCP não acha
 * "CATEGORIAS EXISTENTES", "+ Criar categoria neste bloco" nem o placeholder
 * "Buscar ou criar categoria…".
 *
 * INVERSÃO VERIFICADA: com o código anterior (`git show HEAD:` deste arquivo e
 * de tokens.css) os três testes ficam vermelhos — o `max-h`/`overflow-y-auto`
 * estava no `Popover.Content` inteiro, a largura vinha de
 * `--width-empty-message` (então 320, token da mensagem do estado Vazio
 * `309:49` — hoje corrigido para 340) e as linhas mediam
 * `--height-control` (32) sob um teto de 240 que o Figma não desenha.
 */

// Radix Popover mede o gatilho ao abrir; o jsdom não tem ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// As dez linhas literais de 83:11..83:29, na ordem do frame.
const CATEGORIES = [
  'Academia',
  'Alimentação',
  'Assinaturas',
  'Automóvel',
  'Cuidados pessoais',
  'Cursos',
  'Doações',
  'Educação',
  'Eletrônicos',
  'Entretenimento',
].map((label) => ({ id: label, label }))

function openDropdown() {
  render(
    <SearchCreateField
      items={CATEGORIES}
      query="pet"
      onQueryChange={() => {}}
      onSelect={() => {}}
      onCreate={() => {}}
      createLabel={(term) => `+ Criar categoria "${term}" neste bloco`}
      placeholder="Buscar ou criar categoria…"
    />,
  )
  fireEvent.focus(screen.getByPlaceholderText('Buscar ou criar categoria…'))
}

describe('SearchCreateField — Figma 47:2 §② (Wireframe)', () => {
  it('rola só a lista: o rodapé "+ Criar" fica fora da área rolável (83:62 está fora de 83:10)', () => {
    openDropdown()

    const scroller = document.querySelector('[class*="overflow-y-auto"]')
    expect(scroller).not.toBeNull()
    // 83:10 contém as linhas…
    expect(scroller!.contains(screen.getByRole('button', { name: 'Academia' }))).toBe(true)
    // …e 83:62, o rodapé ancorado em y=239, está FORA dela.
    const create = screen.getByRole('button', { name: '+ Criar categoria "pet" neste bloco' })
    expect(scroller!.contains(create)).toBe(false)
  })

  it('tem a largura do campo âncora (83:4 = 340, igual a 122:4), não a de --width-empty-message', () => {
    openDropdown()

    const content = screen.getByRole('dialog')
    expect(content.className).toContain('w-[var(--radix-popover-trigger-width)]')
    expect(content.className).not.toContain('--width-empty-message')
  })

  it('mede 6 linhas de 29 antes de rolar — o polegar 219:2 confere a conta', () => {
    const css = readFileSync(path.resolve(__dirname, '../../styles/tokens.css'), 'utf8')
    const row = Number(/^\s*--height-dropdown-row:\s*(\d+)px/m.exec(css)?.[1])
    const max = Number(/^\s*--height-dropdown-max:\s*(\d+)px/m.exec(css)?.[1])

    expect(row).toBe(29) // 83:11..83:29, dez linhas idênticas
    expect(max).toBe(174) // 83:10
    expect(max).toBe(row * 6) // corta em linha inteira
    // Polegar = viewport² / conteúdo; conteúdo = 10 linhas + o divisor 83:61.
    expect(Math.round((max * max) / (row * 10 + 1))).toBe(104) // 219:2 mede 104

    openDropdown()
    expect(screen.getByRole('button', { name: 'Academia' }).className).toContain(
      'h-[var(--height-dropdown-row)]',
    )
  })
})

/**
 * files_design/02 ("a lista completa aparece assim que o campo recebe foco,
 * antes de digitar") — com CLIQUE de verdade, não `fireEvent.focus`.
 *
 * Medido em 2026-09-23 no app: clicar em "Buscar ou criar categoria…" dava
 * foco e nenhuma lista; só digitar abria. O input é `Popover.Anchor`, não
 * `Trigger`: o `onFocus` abria, e o próprio clique — que para o Radix é uma
 * interação FORA do conteúdo — fechava em seguida. Os testes acima abrem com
 * `fireEvent.focus` e por isso nunca viram o defeito.
 */
describe('SearchCreateField — abrir com clique (files_design/02)', () => {
  function renderField() {
    render(
      <SearchCreateField
        items={CATEGORIES}
        query=""
        onQueryChange={() => {}}
        onSelect={() => {}}
        onCreate={() => {}}
        listHeading="CATEGORIAS EXISTENTES"
        placeholder="Buscar ou criar categoria…"
      />,
    )
    return screen.getByPlaceholderText('Buscar ou criar categoria…')
  }

  it('clicar no campo vazio mostra a lista completa, antes de digitar', async () => {
    const user = userEvent.setup()
    await user.click(renderField())

    expect(await screen.findByText('CATEGORIAS EXISTENTES')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Academia' })).toBeInTheDocument()
  })

  it('clicar de novo no campo já aberto não fecha a lista', async () => {
    const user = userEvent.setup()
    const input = renderField()
    await user.click(input)
    await user.click(input)

    expect(screen.getByText('CATEGORIAS EXISTENTES')).toBeInTheDocument()
  })

  it('clicar fora fecha a lista', async () => {
    const user = userEvent.setup()
    await user.click(renderField())
    await screen.findByText('CATEGORIAS EXISTENTES')
    await user.click(document.body)

    expect(screen.queryByText('CATEGORIAS EXISTENTES')).not.toBeInTheDocument()
  })
})

/**
 * Medido em 2026-09-23: dentro do Novo Lançamento (um Dialog), a lista abria
 * num portal no <body>, fora do DOM do modal, e o bloqueio de rolagem do
 * Dialog (react-remove-scroll) cancelava todo `wheel` sobre ela — o trackpad
 * não rolava a lista. Ela tem de abrir DENTRO do modal que contém o campo.
 */
describe('SearchCreateField — dentro de um modal', () => {
  it('a lista abre dentro do modal, onde a rolagem não é bloqueada', async () => {
    const user = userEvent.setup()
    render(
      <div role="dialog" aria-label="Modal sintético">
        <SearchCreateField
          items={CATEGORIES}
          query=""
          onQueryChange={() => {}}
          onSelect={() => {}}
          listHeading="CATEGORIAS EXISTENTES"
          placeholder="Buscar ou criar categoria…"
        />
      </div>,
    )
    await user.click(screen.getByPlaceholderText('Buscar ou criar categoria…'))

    const modal = screen.getByRole('dialog', { name: 'Modal sintético' })
    expect(modal).toContainElement(await screen.findByText('CATEGORIAS EXISTENTES'))
  })

  it('fora de modal, continua abrindo no <body>', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <SearchCreateField
        items={CATEGORIES}
        query=""
        onQueryChange={() => {}}
        onSelect={() => {}}
        listHeading="CATEGORIAS EXISTENTES"
        placeholder="Buscar ou criar categoria…"
      />,
    )
    await user.click(screen.getByPlaceholderText('Buscar ou criar categoria…'))

    const heading = await screen.findByText('CATEGORIAS EXISTENTES')
    expect(container).not.toContainElement(heading)
  })
})

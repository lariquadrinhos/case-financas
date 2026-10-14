import { describe, expect, it, beforeEach } from 'vitest'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import {
  HomeLayoutProvider,
  HomeCardShell,
  HomeHeading,
  OrganizeHomeButton,
  useHomeCardOrder,
  type HomeCardMeta,
} from './home-layout'

/**
 * files_design/01 §14: "cada card ganha um handle de arrastar (ícone de 6
 * pontinhos) pra reordenar" — e o próprio texto do modo (`HomeHeading`) diz
 * "arraste pelo ícone pra reordenar". Achado de auditoria (code_ref
 * `home-layout.tsx:226-238`): o ícone é um `<svg aria-hidden>` sem
 * `draggable`, `onDragStart` ou qualquer handler — medido ao vivo com
 * Playwright contra localhost:3098 (`draggable: null` no DOM real) e
 * confirmado por um drag de mouse que não mudou a ordem dos cards.
 */

const META: Record<string, HomeCardMeta> = {
  a: { id: 'a', title: 'Card A', caption: 'Legenda A' },
  b: { id: 'b', title: 'Card B', caption: 'Legenda B' },
  c: { id: 'c', title: 'Card C', caption: 'Legenda C' },
}

function TestHome() {
  const order = useHomeCardOrder()
  return (
    <>
      <HomeHeading greeting="Boa tarde" />
      <OrganizeHomeButton />
      {order.map((id) => (
        <HomeCardShell key={id} meta={META[id] as HomeCardMeta}>
          <p>{id} conteúdo</p>
        </HomeCardShell>
      ))}
    </>
  )
}

function renderHome() {
  return render(
    <HomeLayoutProvider defaultOrder={['a', 'b', 'c']}>
      <TestHome />
    </HomeLayoutProvider>,
  )
}

function dragHandleFor(title: string): HTMLElement {
  const label = screen.getByText(title)
  const header = label.closest('div')
  const handle = header?.querySelector('svg[aria-hidden="true"]')
  if (!handle) throw new Error(`handle not found for ${title}`)
  return handle as HTMLElement
}

function cardContainerFor(title: string): HTMLElement {
  const label = screen.getByText(title)
  const container = label.closest('.relative')
  if (!container) throw new Error(`card container not found for ${title}`)
  return container as HTMLElement
}

function makeDataTransfer() {
  const store = new Map<string, string>()
  return {
    setData: (format: string, data: string) => store.set(format, data),
    getData: (format: string) => store.get(format) ?? '',
    // jsdom has no native DataTransfer, so this mirrors just the surface the
    // real one exposes after `setData`: `types` is a live list of the formats set.
    get types() {
      return [...store.keys()]
    },
    effectAllowed: 'move',
    dropEffect: 'move',
  }
}

function dragAndDrop(sourceTitle: string, targetTitle: string) {
  const handle = dragHandleFor(sourceTitle)
  const targetCard = cardContainerFor(targetTitle)
  const dataTransfer = makeDataTransfer()

  const dragStart = createEvent.dragStart(handle)
  Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer })
  fireEvent(handle, dragStart)

  const dragOver = createEvent.dragOver(targetCard)
  Object.defineProperty(dragOver, 'dataTransfer', { value: dataTransfer })
  fireEvent(targetCard, dragOver)

  const drop = createEvent.drop(targetCard)
  Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer })
  fireEvent(targetCard, drop)
}

beforeEach(() => {
  localStorage.clear()
})

describe('Organizar Home §14 — arrastar pelo ícone de 6 pontinhos reordena de verdade', () => {
  it('soltar o handle de "Card C" sobre "Card A" move C para antes de A', async () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Organizar Home' }))

    const before = screen.getAllByText(/^Card [ABC]$/).map((el) => el.textContent)
    expect(before).toEqual(['Card A', 'Card B', 'Card C'])

    dragAndDrop('Card C', 'Card A')

    const after = screen.getAllByText(/^Card [ABC]$/).map((el) => el.textContent)
    expect(after).toEqual(['Card C', 'Card A', 'Card B'])
  })

  /**
   * Arrastar PRA BAIXO sobre o vizinho imediato era um no-op: removendo a
   * origem e inserindo em `targetIndex - 1` devolve o mesmo índice de onde
   * ela saiu quando o alvo é o vizinho seguinte — a pessoa via o card voltar
   * pro lugar como se o arrasto não tivesse acontecido.
   */
  it('soltar o handle de "Card A" sobre "Card B" move A para depois de B (arrasto pra baixo)', async () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Organizar Home' }))

    const before = screen.getAllByText(/^Card [ABC]$/).map((el) => el.textContent)
    expect(before).toEqual(['Card A', 'Card B', 'Card C'])

    dragAndDrop('Card A', 'Card B')

    const after = screen.getAllByText(/^Card [ABC]$/).map((el) => el.textContent)
    expect(after).toEqual(['Card B', 'Card A', 'Card C'])
  })
})

/**
 * files_design/07-style-guide.md §Biblioteca de componentes, "Botão de
 * ícone" (linha ~292/294): componente novo desta revisão, "Padrão é
 * transparente" — e a própria seção cita "as setas do seletor de mês" (ver
 * `month-nav.tsx`, `variant="text" size="icon"`) e "o drag-handle de
 * reordenar card (Organizar Home)" como exemplos concretos do MESMO
 * componente. As setas de mover card pra cima/baixo, no mesmo modo de
 * organização, são o mesmo tipo de ícone-alvo-de-clique-único — sem
 * `variant="text"` elas caem no `defaultVariants` de `button.tsx`
 * (`variant: 'secondary'`), que pinta `bg-surface-card border
 * border-line-control` em vez do fundo transparente documentado.
 */
describe('Organizar Home §14 — Botão de ícone das setas de mover usa o estado Padrão (transparente)', () => {
  it('"Mover para cima" e "Mover para baixo" não usam o fundo/borda do Botão Secundário', () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Organizar Home' }))

    const ups = screen.getAllByRole('button', { name: 'Mover para cima' })
    const downs = screen.getAllByRole('button', { name: 'Mover para baixo' })

    for (const button of [...ups, ...downs]) {
      expect(button.className).toContain('bg-transparent')
      expect(button.className).not.toContain('bg-surface-card')
      expect(button.className).not.toContain('border-line-control')
    }
  })
})

'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle, CardCaption } from '@/components/ui/card'
import { cn } from '@/lib/cn'

/**
 * Organizar Home — files_design/01 §14.
 *
 * A card's position and minimized state are a display preference with no
 * server-side meaning (like the theme, ADR-0009 §4), so they live in
 * `localStorage`, keyed per card id, never sent with a request.
 */

export interface HomeCardMeta {
  readonly id: string
  readonly title: string
  readonly caption: string
}

interface HomeLayoutContextValue {
  readonly order: readonly string[]
  readonly minimized: ReadonlySet<string>
  readonly editing: boolean
  setEditing(value: boolean): void
  toggleMinimized(id: string): void
  moveCard(id: string, direction: 'up' | 'down'): void
  reorderCard(sourceId: string, targetId: string): void
}

const HomeLayoutContext = React.createContext<HomeLayoutContextValue | null>(null)

const STORAGE_KEY = 'bigorna.home.layout'

interface StoredLayout {
  order: string[]
  minimized: string[]
}

function readStoredLayout(defaultOrder: readonly string[]): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { order: [...defaultOrder], minimized: [] }
    const parsed = JSON.parse(raw) as Partial<StoredLayout>
    const storedOrder = Array.isArray(parsed.order) ? parsed.order : []
    // A card added to the product after the layout was saved still has to
    // show up — append anything missing from the stored order, in default position.
    const order = [...storedOrder.filter((id) => defaultOrder.includes(id))]
    for (const id of defaultOrder) if (!order.includes(id)) order.push(id)
    const minimized = Array.isArray(parsed.minimized) ? parsed.minimized : []
    return { order, minimized }
  } catch {
    return { order: [...defaultOrder], minimized: [] }
  }
}

export function HomeLayoutProvider({
  defaultOrder,
  children,
}: {
  defaultOrder: readonly string[]
  children: React.ReactNode
}) {
  const [order, setOrder] = React.useState<string[]>(() => [...defaultOrder])
  const [minimized, setMinimized] = React.useState<Set<string>>(() => new Set())
  const [editing, setEditing] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    const stored = readStoredLayout(defaultOrder)
    setOrder(stored.order)
    setMinimized(new Set(stored.minimized))
    setHydrated(true)
    // Only ever read once, on mount — `defaultOrder` is a static constant from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (!hydrated) return
    try {
      const toStore: StoredLayout = { order, minimized: [...minimized] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    } catch {
      // Private mode / storage disabled: the preference just does not persist this session.
    }
  }, [order, minimized, hydrated])

  const toggleMinimized = React.useCallback((id: string) => {
    setMinimized((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const moveCard = React.useCallback((id: string, direction: 'up' | 'down') => {
    setOrder((current) => {
      const index = current.indexOf(id)
      const target = direction === 'up' ? index - 1 : index + 1
      if (index === -1 || target < 0 || target >= current.length) return current
      const next = [...current]
      const temp = next[target] as string
      next[target] = next[index] as string
      next[index] = temp
      return next
    })
  }, [])

  const reorderCard = React.useCallback((sourceId: string, targetId: string) => {
    setOrder((current) => {
      if (sourceId === targetId) return current
      const sourceIndex = current.indexOf(sourceId)
      const targetIndex = current.indexOf(targetId)
      if (sourceIndex === -1 || targetIndex === -1) return current
      const next = [...current]
      next.splice(sourceIndex, 1)
      // Insert at the target's index IN `next` (post-removal), not `current`.
      // Measured: subtracting 1 whenever the target was after the source made
      // dragging a card onto its immediate next neighbour a no-op (removing
      // then re-inserting at the same index it just left) — every downward
      // drag onto an adjacent card silently did nothing.
      next.splice(targetIndex, 0, sourceId)
      return next
    })
  }, [])

  const value = React.useMemo<HomeLayoutContextValue>(
    () => ({ order, minimized, editing, setEditing, toggleMinimized, moveCard, reorderCard }),
    [order, minimized, editing, toggleMinimized, moveCard, reorderCard],
  )

  return <HomeLayoutContext.Provider value={value}>{children}</HomeLayoutContext.Provider>
}

function useHomeLayout(): HomeLayoutContextValue {
  const context = React.useContext(HomeLayoutContext)
  if (!context) throw new Error('useHomeLayout must be used inside HomeLayoutProvider')
  return context
}

/** "Organizar Home" / "Concluir" — files_design/01 §4, §14. */
export function OrganizeHomeButton() {
  const { editing, setEditing } = useHomeLayout()
  return (
    <Button variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing(!editing)}>
      {editing ? 'Concluir' : 'Organizar Home'}
    </Button>
  )
}

/** Orders the caller's card ids according to the current layout, minimized or not. */
export function useHomeCardOrder(): readonly string[] {
  return useHomeLayout().order
}

/**
 * O cabeçalho da Home enquanto o modo de organização está ligado — frame
 * `317:5`, texto `323:1823`, que ocupa EXATAMENTE o lugar da saudação (mesmo
 * frame `x=48, y=40`, ao lado de "Concluir"). A saudação continua sendo o
 * <h1> da página, só que invisível: trocar o texto não pode custar à página o
 * seu único cabeçalho de nível 1.
 */
export function HomeHeading({ greeting }: { greeting: string }) {
  const { editing } = useHomeLayout()
  if (!editing) return <h1 className="text-style-heading-xl text-ink-primary">{greeting}</h1>
  return (
    <>
      <h1 className="sr-only">{greeting}</h1>
      <p className="text-style-body-sm text-ink-secondary">
        Modo de organização: arraste pelo ícone pra reordenar, ou minimize um card pra escondê-lo
        (sem perder o lugar dele).
      </p>
    </>
  )
}

/**
 * Wraps one Home card with its minimized / organizing chrome. files_design/01
 * §14: in edit mode every card gets a drag handle and a "Minimizar" button and
 * its own content is dimmed so accidental clicks land nowhere; a minimized
 * card always collapses to a thin row with its own always-active "Maximizar",
 * independent of edit mode.
 */
export function HomeCardShell({
  meta,
  children,
}: {
  meta: HomeCardMeta
  children: React.ReactNode
}) {
  const { editing, minimized, toggleMinimized, moveCard, reorderCard } = useHomeLayout()
  const isMinimized = minimized.has(meta.id)

  // `dataTransfer` (not React state) carries the dragged id across elements —
  // it is the one channel the native drag events give us between the handle
  // that starts the drag and the card that receives the drop.
  const DRAG_MIME = 'application/x-bigorna-home-card-id'
  const handleDragStart = (event: React.DragEvent<HTMLSpanElement>) => {
    event.dataTransfer.setData(DRAG_MIME, meta.id)
    event.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types?.includes(DRAG_MIME)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const sourceId = event.dataTransfer.getData(DRAG_MIME)
    if (!sourceId) return
    event.preventDefault()
    reorderCard(sourceId, meta.id)
  }

  if (isMinimized) {
    return (
      <Card className="flex items-center justify-between gap-16 px-20 py-16">
        <div className="flex flex-col gap-4">
          <CardTitle level={3}>{meta.title}</CardTitle>
          <CardCaption>{meta.caption}</CardCaption>
        </div>
        <Button onClick={() => toggleMinimized(meta.id)}>Maximizar</Button>
      </Card>
    )
  }

  return (
    <div
      className="relative"
      onDragOver={editing ? handleDragOver : undefined}
      onDrop={editing ? handleDrop : undefined}
    >
      {editing ? (
        <div className="mb-8 flex items-center justify-between gap-8">
          <div className="flex items-center gap-8 text-ink-secondary">
            <DragHandleIcon onDragStart={handleDragStart} />
            <span className="text-style-label-xs">{meta.title}</span>
          </div>
          <div className="flex items-center gap-8">
            <Button
              variant="text"
              size="icon"
              aria-label="Mover para cima"
              onClick={() => moveCard(meta.id, 'up')}
            >
              ↑
            </Button>
            <Button
              variant="text"
              size="icon"
              aria-label="Mover para baixo"
              onClick={() => moveCard(meta.id, 'down')}
            >
              ↓
            </Button>
            <Button onClick={() => toggleMinimized(meta.id)}>Minimizar</Button>
          </div>
        </div>
      ) : null}
      <div
        aria-hidden={editing || undefined}
        className={cn(editing && 'pointer-events-none select-none opacity-40')}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * files_design/01 §14 e o texto do próprio modo ("arraste pelo ícone pra
 * reordenar", `HomeHeading` acima): o ícone precisa ser o próprio handle de
 * arrasto, não só um enfeite ao lado de um botão de arrastar.
 */
function DragHandleIcon({
  onDragStart,
}: {
  onDragStart: (event: React.DragEvent<HTMLSpanElement>) => void
}) {
  return (
    // `draggable` lives on this `span`, not the `svg`, because React's
    // `SVGProps` has no `draggable` (TS2322) even though the DOM attribute
    // itself is valid on SVG — the wrapper sidesteps the type gap.
    <span
      draggable
      onDragStart={onDragStart}
      className="inline-flex cursor-grab active:cursor-grabbing"
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="shrink-0"
      >
        {[4, 8, 12].flatMap((cy) =>
          [5, 11].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" />),
        )}
      </svg>
    </span>
  )
}

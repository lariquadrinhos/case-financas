import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Loading, SKELETON_BARS } from './loading'

/**
 * O estado "Carregando" — o Wireframe desenhou os 15, e o código tinha
 * inventado outro formato.
 *
 * Os frames existem em docs/figma/frames/ (`grep -c 'Carregando —'
 * docs/figma/INDEX.md` devolve 15) e desenham UMA construção só:
 *
 *   frame `309:26` "Carregando — Pendências" ....... 420 × 114
 *     rounded-rectangle `309:27` .. x=24 y=24  **180** × **14**
 *     rounded-rectangle `309:28` .. x=24 y=50  **240** × **14**
 *     rounded-rectangle `309:29` .. x=24 y=76  **200** × **14**
 *
 * Barra de 14 de altura, recuo 24, passo 26 (logo gap 12), e a altura do card
 * fechando em 36 + 26n. As 47 barras dos 15 frames têm h=14 sem exceção.
 *
 * INVERSÃO VERIFICADA (`git show HEAD:` nos dois arquivos):
 *  - `--height-card-placeholder: 96px` era a única linha do bloco "[derived]
 *    Layout facts sampled from the Figma frames" sem citar nó, e 96 não é
 *    medida de nada nesta série: nem altura de card (88/114/140/166/192), nem
 *    de barra (14), nem passo (26), nem recuo (24).
 *  - Seu único consumidor, `LoadingCards`, desenhava BLOCOS maciços de 96 de
 *    altura e largura total. Pendências chamava `<LoadingCards count={2} />`:
 *    2 blocos com `gap-24` = 216px de altura, onde `309:26` desenha 3 barras
 *    finas num card de 114.
 *  - `Loading` usava `h-[var(--space-16)]` (16px) onde os 15 frames desenham
 *    14, e uma rampa de largura em porcentagem inventada
 *    (45/60/50/70/40%) igual para todas as telas, onde cada frame desenha a
 *    sua.
 */

const FRAMES_DIR = path.resolve(__dirname, '../../../docs/figma/frames')

/** Node id do frame → a chave que `SKELETON_BARS` usa para ele. */
const FRAME_TO_KEY: Record<string, keyof typeof SKELETON_BARS> = {
  '309:26': 'PENDENCIAS',
  '309:30': 'MAPA_DE_FLUXO',
  '309:35': 'DESPESAS_POR_CATEGORIA',
  '309:38': 'ONDE_ESTA_MEU_DINHEIRO',
  '309:41': 'EVENTOS_RECENTES',
  '309:68': 'DRE',
  '309:75': 'BALANCO_PATRIMONIAL',
  '309:79': 'EVOLUCAO_MENSAL',
  '309:83': 'INDICADORES_FINANCEIROS',
  '309:124': 'REVISAO_DE_RECORRENTES',
  '309:128': 'HISTORICO',
  '309:133': 'CONTAS_BANCARIAS',
  '309:136': 'BENS_MATERIAIS',
  '309:139': 'INVESTIMENTOS',
  '309:142': 'PASSIVOS',
}

type DrawnFrame = { id: string; name: string; height: number; bars: { w: number; h: number }[] }

/** Lê os frames "Carregando —" direto do XML exportado do Figma. */
function readLoadingFrames(): DrawnFrame[] {
  return readdirSync(FRAMES_DIR)
    .filter((f) => f.includes('carregando'))
    .map((f) => {
      const xml = readFileSync(path.join(FRAMES_DIR, f), 'utf8')
      const head = /<frame id="([^"]+)" name="([^"]+)"[^>]*height="([\d.]+)"/.exec(xml)
      if (!head) throw new Error(`frame sem cabeçalho legível: ${f}`)
      const [, id = '', name = '', height = ''] = head
      const bars = [...xml.matchAll(/<rounded-rectangle[^>]*width="([\d.]+)" height="([\d.]+)"/g)]
      return {
        id,
        name,
        height: Number(height),
        bars: bars.map((m) => {
          const [, w = '', h = ''] = m
          return { w: Number(w), h: Number(h) }
        }),
      }
    })
}

function barsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[aria-hidden="true"]')]
}

describe('Loading — Figma 309:26 … 309:142', () => {
  const frames = readLoadingFrames()

  it('o Wireframe desenha os 15 estados Carregando (não é estado sem desenho)', () => {
    expect(frames).toHaveLength(15)
  })

  it('Figma 309:26 — Pendências desenha 3 barras de 180/240/200, não 2 blocos', () => {
    const { container } = render(<Loading bars={SKELETON_BARS.PENDENCIAS} />)
    const bars = barsOf(container)

    expect(bars).toHaveLength(3)
    // 180/420, 240/420, 200/420 — ver o porquê da fração em loading.tsx
    expect(bars.map((b) => b.style.width)).toEqual(['42.86%', '57.14%', '47.62%'])
  })

  it('Figma 309:27 — a barra tem 14 de altura (--height-skeleton-bar), não 16', () => {
    const { container } = render(<Loading bars={SKELETON_BARS.PENDENCIAS} />)

    for (const bar of barsOf(container)) {
      expect(bar.className).toContain('h-[var(--height-skeleton-bar)]')
      expect(bar.className).not.toContain('--space-16')
      expect(bar.className).not.toContain('--height-card-placeholder')
    }
  })

  it('tokens.css declara a altura de barra que os frames desenham, e some com o 96 sem fonte', () => {
    const tokens = readFileSync(path.resolve(__dirname, '../../styles/tokens.css'), 'utf8')
    const declarations = tokens
      .split('\n')
      .filter((line) => /^\s*--/.test(line))
      .join('\n')

    // A altura vem dos frames, não de um número digitado aqui: as 47 barras
    // dos 15 frames têm a mesma, e é ela que o token tem de declarar.
    const drawn = [...new Set(frames.flatMap((f) => f.bars.map((b) => b.h)))]
    expect(drawn).toEqual([14])

    expect(declarations).toContain(`--height-skeleton-bar: ${drawn[0]}px;`)
    expect(declarations).not.toContain('--height-card-placeholder')
  })

  it.each(frames.map((f) => [f.name, f] as const))(
    '%s — a rampa e a contagem de barras batem com o XML do frame',
    (_name, frame) => {
      const key = FRAME_TO_KEY[frame.id]
      expect(key, `frame ${frame.id} sem entrada em SKELETON_BARS`).toBeDefined()
      if (!key) return

      // Toda barra dos 15 frames tem 14 de altura: é o que o token afirma.
      expect(frame.bars.map((b) => b.h)).toEqual(frame.bars.map(() => 14))
      // A rampa desenhada, literal.
      expect([...SKELETON_BARS[key]]).toEqual(frame.bars.map((b) => b.w))
      // ...e a contagem fecha a altura do card: 36 + 26n.
      expect(36 + 26 * frame.bars.length).toBe(frame.height)
    },
  )

  it.each(frames.map((f) => [f.name, f] as const))(
    '%s — renderiza exatamente as barras que o frame desenha',
    (_name, frame) => {
      const key = FRAME_TO_KEY[frame.id]
      if (!key) throw new Error(`frame ${frame.id} sem entrada em SKELETON_BARS`)
      const { container } = render(<Loading bars={SKELETON_BARS[key]} />)
      expect(barsOf(container)).toHaveLength(frame.bars.length)
    },
  )

  it('anuncia o carregamento para leitor de tela (as barras ficam aria-hidden)', () => {
    const { container, getByRole } = render(
      <Loading label="Carregando DRE" bars={SKELETON_BARS.DRE} />,
    )
    expect(getByRole('status')).toHaveTextContent('Carregando DRE')
    expect(barsOf(container)).toHaveLength(6)
  })
})

describe('As telas apontam para a rampa do seu próprio frame', () => {
  const SCREENS: [string, keyof typeof SKELETON_BARS][] = [
    ['src/app/(app)/inicio/_components/pending-items-card.tsx', 'PENDENCIAS'],
    ['src/app/(app)/inicio/_components/cash-flow-card.tsx', 'MAPA_DE_FLUXO'],
    ['src/app/(app)/inicio/_components/expenses-by-category-card.tsx', 'DESPESAS_POR_CATEGORIA'],
    ['src/app/(app)/inicio/_components/money-map-card.tsx', 'ONDE_ESTA_MEU_DINHEIRO'],
    ['src/app/(app)/inicio/_components/recent-events-card.tsx', 'EVENTOS_RECENTES'],
    ['src/app/(app)/dre/page.tsx', 'DRE'],
    ['src/app/(app)/balanco-patrimonial/page.tsx', 'BALANCO_PATRIMONIAL'],
    ['src/app/(app)/evolucao-mensal/page.tsx', 'EVOLUCAO_MENSAL'],
    ['src/app/(app)/indicadores-financeiros/page.tsx', 'INDICADORES_FINANCEIROS'],
    [
      'src/app/(app)/revisao-de-recorrentes/_components/recurrence-review-screen.tsx',
      'REVISAO_DE_RECORRENTES',
    ],
    ['src/app/(app)/historico/page.tsx', 'HISTORICO'],
    ['src/app/onboarding/contas-bancarias/page.tsx', 'CONTAS_BANCARIAS'],
    ['src/app/onboarding/bens-materiais/page.tsx', 'BENS_MATERIAIS'],
    ['src/app/onboarding/investimentos/page.tsx', 'INVESTIMENTOS'],
    ['src/app/onboarding/passivos/page.tsx', 'PASSIVOS'],
    ['src/features/plano-de-contas-e-patrimonio/screens/contas-bancarias.tsx', 'CONTAS_BANCARIAS'],
    ['src/features/plano-de-contas-e-patrimonio/screens/bens-materiais.tsx', 'BENS_MATERIAIS'],
    ['src/features/plano-de-contas-e-patrimonio/screens/investimentos.tsx', 'INVESTIMENTOS'],
    ['src/features/plano-de-contas-e-patrimonio/screens/passivos.tsx', 'PASSIVOS'],
  ]
  const root = path.resolve(__dirname, '../../..')

  it.each(SCREENS)('%s usa SKELETON_BARS.%s', (file, key) => {
    const source = readFileSync(path.join(root, file), 'utf8')
    expect(source).toContain(`bars={SKELETON_BARS.${key}}`)
    // `lines` é a saída só para tela SEM frame; estas têm frame.
    expect(source).not.toMatch(/<Loading[^>]*\slines=/)
  })

  it('LoadingCards não existe mais: os frames desenham barras, não blocos', () => {
    const source = readFileSync(path.join(__dirname, 'loading.tsx'), 'utf8')
    expect(source).not.toContain('LoadingCards')
  })
})

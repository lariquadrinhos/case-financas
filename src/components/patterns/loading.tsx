import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

/**
 * Largura do card em que o Wireframe desenhou os 15 estados "Carregando"
 * (`309:26` … `309:142`). É o divisor das larguras de `SKELETON_BARS`, não uma
 * medida aplicada: nenhum elemento da tela tem 420 de largura.
 */
const FRAME_WIDTH = 420

/**
 * As larguras de barra que o Figma desenhou, uma lista por tela, na largura do
 * card do próprio frame (420). Ver `SKELETON_BARS` abaixo para os node ids.
 *
 * Por que fração de 420 e não px absoluto: `--width-empty-message: 340px` é px
 * porque medida de parágrafo é comprimento de linha — 340 é 340 em qualquer
 * card. Barra de esqueleto não; ela substitui uma LINHA QUE ATRAVESSA o card.
 * `309:32` desenha 380 de 420, isto é "esta linha enche ~90% da largura".
 * Fixada em 380px dentro da coluna de 1088 (`--width-content-max`, medida em
 * 549:71 / 397:27 na Mockup) ela leria 35% e deixaria de parecer o desenho.
 */
function barWidth(drawnWidth: number): string {
  return `${((drawnWidth / FRAME_WIDTH) * 100).toFixed(2)}%`
}

/**
 * A rampa de larguras que cada frame "Carregando —" desenha, literal do XML em
 * docs/figma/frames/. O NÚMERO de barras é o que cada frame varia, e é ele que
 * fecha a altura do card: 36 + 26n (2 barras → 88, 3 → 114, 4 → 140, 5 → 166,
 * 6 → 192). Por isso a contagem não é escolha de quem chama — vem daqui.
 */
export const SKELETON_BARS = {
  /** Figma `309:26` — Pendências (420×114) */
  PENDENCIAS: [180, 240, 200],
  /** Figma `309:30` — Mapa de Fluxo (420×140) */
  MAPA_DE_FLUXO: [260, 340, 380, 300],
  /** Figma `309:35` — Despesas por Categoria (420×88) */
  DESPESAS_POR_CATEGORIA: [200, 380],
  /** Figma `309:38` — Onde Está Meu Dinheiro (420×88) */
  ONDE_ESTA_MEU_DINHEIRO: [200, 380],
  /** Figma `309:41` — Eventos Recentes (420×166) */
  EVENTOS_RECENTES: [340, 320, 300, 280, 260],
  /** Figma `309:68` — DRE (420×192) */
  DRE: [200, 260, 240, 220, 260, 300],
  /** Figma `309:75` — Balanço Patrimonial (420×114) */
  BALANCO_PATRIMONIAL: [180, 300, 260],
  /** Figma `309:79` — Evolução Mensal (420×114) */
  EVOLUCAO_MENSAL: [220, 340, 300],
  /** Figma `309:83` — Indicadores Financeiros (420×140) */
  INDICADORES_FINANCEIROS: [200, 280, 260, 240],
  /** Figma `309:124` — Revisão de Recorrentes (420×114) */
  REVISAO_DE_RECORRENTES: [260, 380, 340],
  /** Figma `309:128` — Histórico (420×140) */
  HISTORICO: [260, 380, 340, 300],
  /** Figma `309:133` — Contas Bancárias (420×88) */
  CONTAS_BANCARIAS: [220, 340],
  /** Figma `309:136` — Bens Materiais (420×88) */
  BENS_MATERIAIS: [220, 340],
  /** Figma `309:139` — Investimentos (420×88) */
  INVESTIMENTOS: [220, 340],
  /** Figma `309:142` — Passivos (420×88) */
  PASSIVOS: [220, 340],
} as const satisfies Record<string, readonly number[]>

/**
 * Rampa para as telas que o Wireframe NÃO desenhou carregando — Novo
 * Lançamento, Plano de Contas, Destinar o Lucro e o detalhe do Passivo. O
 * `grep -c 'Carregando —' docs/figma/INDEX.md` devolve exatamente 15 frames, e
 * nenhum é dessas telas; a página Mockup não desenha esqueleto nenhum e o
 * style guide (`383:2`) não tem componente Esqueleto. Na falta do desenho,
 * repete-se a rampa de `309:128` "Carregando — Histórico", o frame da tela de
 * lista genérica, em vez de inventar um formato novo.
 */
const GENERIC_BARS = SKELETON_BARS.HISTORICO

/**
 * Loading — o estado "Carregando" que o Wireframe desenhou para 15 telas
 * (`309:26` … `309:142`). Os 15 frames compartilham UMA construção, medida nos
 * XML de docs/figma/frames/:
 *
 *   - card de 420 de largura, barras recuadas em x=24  → `p-24`
 *   - toda barra com 14 de altura                      → `--height-skeleton-bar`
 *   - passo vertical de 26 (24→50→76→102→128→154)      → gap 26 − 14 = `gap-12`
 *
 * Referência literal, `309:26` "Carregando — Pendências", 420×114:
 *   rounded-rectangle `309:27`  x=24  y=24  **180**×**14**
 *   rounded-rectangle `309:28`  x=24  y=50  **240**×**14**
 *   rounded-rectangle `309:29`  x=24  y=76  **200**×**14**
 *
 * As barras são `aria-hidden`; o anúncio mora neste wrapper, como live region
 * educada com uma frase de verdade. Sem isso quem usa leitor de tela recebe
 * silêncio e não distingue página carregando de página quebrada.
 */
export function Loading({
  label = 'Carregando',
  bars,
  lines,
  className,
}: {
  label?: string
  /** A rampa desenhada para esta tela. Passe uma entrada de `SKELETON_BARS`. */
  bars?: readonly number[]
  /** Só para tela sem frame: quantas barras tirar de `GENERIC_BARS`. */
  lines?: number
  className?: string
}) {
  const widths: readonly number[] =
    bars ??
    Array.from(
      { length: lines ?? GENERIC_BARS.length },
      (_, i) => GENERIC_BARS[i % GENERIC_BARS.length] ?? GENERIC_BARS[0],
    )

  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-12 p-24', className)}>
      <span className="sr-only">{label}</span>
      {widths.map((drawnWidth, index) => (
        <Skeleton
          key={index}
          className="h-[var(--height-skeleton-bar)]"
          style={{ width: barWidth(drawnWidth) }}
        />
      ))}
    </div>
  )
}

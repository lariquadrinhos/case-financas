/**
 * Biblioteca de ícones — files_design/07 §"Biblioteca de ícones": grade de
 * 20×20px, traço de 1,5px com ponta e junção arredondadas, sem preenchimento,
 * cor padrão `color/text/secondary` (`text-ink-secondary`), sobrescrevível por
 * instância porque "cor não é fixa no componente".
 *
 * Regra 9 do processo de mockup (mesmo doc): **nunca redimensionar uma
 * instância de `icon/*`** — o desenho interno tem `constraints: MIN/MIN`, não
 * `SCALE`, então redimensionar corta/desloca o vetor em vez de escalar. Se o
 * conjunto ficar apertado, o ajuste é no espaçamento ao redor, nunca no
 * tamanho do ícone. Daí o 20×20 fixo aqui, sem prop de tamanho.
 *
 * Os dois `d` abaixo são o traçado literal exportado dos masters do arquivo
 * Figma `7IZBeQV15kgZp7Shcqh4c8`: `icon/arrow-left` (470:8) e
 * `icon/arrow-right` (470:10) — um `<vector>` de 8×8 posicionado em (6,6)
 * dentro da caixa de 20×20, o que dá a haste em y=10 de x=6 a x=14 e a ponta
 * a 45°.
 */

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  // `shrink-0` porque a instância nunca é redimensionada (regra 9 do processo
  // de mockup, files_design/07): num contêiner flex apertado o SVG encolheria
  // e o traçado sairia do lugar.
  className: 'shrink-0 text-ink-secondary',
} as const

/** `icon/arrow-left` (Figma 470:8). */
export function ArrowLeftIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 10H6M10 14L6 10L10 6" />
    </svg>
  )
}

/** `icon/arrow-right` (Figma 470:10). */
export function ArrowRightIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 10H14M10 14L14 10L10 6" />
    </svg>
  )
}

/**
 * `icon/chevron-down` (Figma 470:2) — expandir/colapsar, estado EXPANDIDO.
 * O `<vector>` do master (470:3) mede 8×4 em (6,8) dentro da caixa de 20×20,
 * daí `M6 8 → L10 12 → L14 8`. Confirmado em uso na Style guide, frame
 * 544:460 → 471:5 "cel/chevron-down" ("seta para baixo").
 */
export function ChevronDownIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 8L10 12L14 8" />
    </svg>
  )
}

/**
 * `icon/chevron-right` (Figma 470:4) — o mesmo par, estado RECOLHIDO. O
 * `<vector>` do master (470:5) mede 4×8 em (8,6), daí `M8 6 → L12 10 → L8 14`.
 * Style guide 544:460 → 471:7 "cel/chevron-right" ("seta lateral").
 */
export function ChevronRightIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 6L12 10L8 14" />
    </svg>
  )
}

/**
 * `icon/repeat` — marca o que é recorrente (pedido do dono, 2026-10-01: "que
 * tal algum ícone?"). NÃO ESTÁ NO FIGMA: os 16 da biblioteca não têm um de
 * repetição; desenhado na mesma regra (20×20, traço 1,5, pontas e junções
 * arredondadas, sem preenchimento) e pendente de entrar como `icon/repeat`.
 * Duas setas em laço: a de cima vai para a direita, a de baixo volta.
 */
export function RepeatIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 9V8.5A2.5 2.5 0 0 1 7.5 6H15M13 4L15 6L13 8" />
      <path d="M15 11V11.5A2.5 2.5 0 0 1 12.5 14H5M7 16L5 14L7 12" />
    </svg>
  )
}

/**
 * `icon/credit-card` — a marca "Cartão de crédito" de uma despesa (ADR-0021).
 * NÃO ESTÁ NO FIGMA: desenhado na mesma regra (20×20, traço 1,5, pontas
 * arredondadas, sem preenchimento) e pendente de entrar na biblioteca.
 * Um retângulo de cantos arredondados com a tarja magnética.
 */
export function CreditCardIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M3 8.5H17M6 12H8.5" />
    </svg>
  )
}

/**
 * `icon/eye` e `icon/eye-off` — o "olhinho" da simulação do DRE (pedido do
 * dono, 2026-10-01). NÃO ESTÃO NO FIGMA: desenhados na mesma regra (20×20,
 * traço 1,5, pontas arredondadas, sem preenchimento) e pendentes de entrar na
 * biblioteca. `eye-off` é o olho fechado (ver abaixo).
 */
export function EyeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2.5 10C4 6.5 6.8 5 10 5C13.2 5 16 6.5 17.5 10C16 13.5 13.2 15 10 15C6.8 15 4 13.5 2.5 10Z" />
      <path d="M12.5 10A2.5 2.5 0 1 1 7.5 10A2.5 2.5 0 0 1 12.5 10Z" />
    </svg>
  )
}

/**
 * `icon/eye-off` é um olho FECHADO — a pálpebra em curva para baixo e três
 * cílios — e não o olho riscado: "faz o olhinho abrir e fechar para ser
 * visualmente mais legível" (dono, 2026-10-01).
 */
export function EyeOffIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2.5 8.5C4 11.5 6.8 13 10 13C13.2 13 16 11.5 17.5 8.5" />
      <path d="M10 13V15.5M5.5 11.5L4 13.5M14.5 11.5L16 13.5" />
    </svg>
  )
}

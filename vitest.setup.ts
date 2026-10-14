import '@testing-library/jest-dom/vitest'

/**
 * P40, medido em 2026-09-09: os diálogos que abrem um Popover ou um Select do
 * Radix levavam ~9 SEGUNDOS por interação, com o laço de eventos bloqueado o
 * tempo todo (um `setInterval` de 50ms disparou UMA vez em 8,2s). O DOM tinha
 * 103 nós e as consultas do testing-library levavam 0–3ms: o custo não era
 * procurar o elemento, era ele demorar a existir.
 *
 * O perfil de CPU do V8, tirado de dentro do teste, mostrou 95% do tempo em
 * `nwsapi` numa recursão mútua de ~600 quadros:
 *
 *   @floating-ui/utils `isTopLayer(el)`  →  el.matches(':modal')
 *     → jsdom delega ao nwsapi, que não tem estado de top layer
 *     → nwsapi `isModal` = `matchesNative(node, ':modal') || isFullscreen(node)`
 *     → `matchesNative` reusa `Element.prototype.matches`, que É o nwsapi
 *     → volta ao começo, até o try/catch de `matchesNative` cortar
 *
 * São 46 chamadas dessas por teste (`:modal` e `:popover-open`, 23 cada),
 * porque o Popover e o Select posicionam via @floating-ui. nwsapi 2.2.27 é a
 * última versão publicada e a recursão está lá; não há upgrade que resolva.
 *
 * O corte é honesto, não um truque: o jsdom não implementa top layer nenhum,
 * então `:modal`, `:popover-open` e `:fullscreen` são SEMPRE falsos ali. O que
 * o patch faz é responder isso direto, em vez de deixar as duas bibliotecas
 * chegarem à mesma resposta se chamando em círculo.
 *
 * Efeito medido na suíte inteira: o pior teste caiu de 18,7s para 0,3s.
 */
const TOP_LAYER_PSEUDOS = new Set([':modal', ':popover-open', ':fullscreen'])
const nativeMatches = Element.prototype.matches
Element.prototype.matches = function matches(this: Element, selector: string): boolean {
  if (TOP_LAYER_PSEUDOS.has(selector)) return false
  return nativeMatches.call(this, selector)
}

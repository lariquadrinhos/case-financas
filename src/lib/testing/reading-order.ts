/**
 * P42 — a ordem de leitura de uma tela, conferida contra a ordem dos nós do
 * frame do Figma.
 *
 * A auditoria cruzada de 2026-09-08 comparou TEXTO: 177 termos das 32 telas.
 * Isso pega vocabulário trocado, rótulo ausente e erro de digitação, e não pega
 * ordem, agrupamento, espaçamento, alinhamento nem divisória.
 *
 * Decidido em 2026-09-09: **só a ordem é automatizada.** Ela é mecânica e
 * estável — não depende de pixel, e por isso não quebra porque o app é fluido e
 * o Mockup é fixo em 1440. Espaçamento, alinhamento, largura de coluna e
 * divisória continuam sendo olho humano, e o checklist de tela diz isso.
 *
 * O que ela pega: campo fora de lugar, seção trocada, bloco ausente, cabeçalho
 * depois do corpo.
 */

/**
 * Falha se os elementos não aparecerem no DOM nesta ordem — ou se algum não
 * existir, que é o caso "bloco ausente".
 *
 * A comparação é `compareDocumentPosition`, não índice de texto: duas seções
 * podem repetir a mesma palavra, e comparar posição no `textContent` acharia a
 * primeira ocorrência das duas e passaria por acaso.
 */
export function assertReadingOrder(
  elements: readonly (Element | null)[],
  labels: readonly string[],
): void {
  elements.forEach((element, index) => {
    if (element === null) {
      throw new Error(`ordem de leitura: "${labels[index] ?? index}" não está na tela`)
    }
  })
  for (let i = 1; i < elements.length; i += 1) {
    const previous = elements[i - 1] as Element
    const current = elements[i] as Element
    const isAfter =
      (previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    if (!isAfter) {
      throw new Error(
        `ordem de leitura: "${labels[i] ?? i}" aparece ANTES de "${labels[i - 1] ?? i - 1}", ` +
          'e o frame do Figma põe na ordem inversa',
      )
    }
  }
}

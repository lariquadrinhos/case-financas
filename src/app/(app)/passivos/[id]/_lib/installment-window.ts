/**
 * Which rows the "Parcelas" card of Detalhe do Passivo actually draws.
 *
 * files_design/02 (log de decisões, "Detalhe do Passivo"): a lista das
 * parcelas é **truncada**, com "mais uma linha final '...346 parcelas
 * restantes' avisando que a lista é truncada". Figma `91:99`-`91:132` desenha
 * a regra completa com números: um Passivo de 360 parcelas, 12 pagas, mostra
 * `#11`, `#12` (Pagas), `#13`, `#14` (Previstas) e fecha com
 * "... 346 parcelas restantes" — 360 − 14, ou seja, o rodapé conta só o que
 * ficou DEPOIS da janela.
 *
 * A janela é ancorada em "hoje" (parcelas pagas + 1), a mesma âncora que
 * files_design/08 §3.6 já fixa pro gráfico logo acima: as duas últimas Pagas
 * mais as próximas Previstas, quatro linhas no total. Puro e sem React de
 * propósito — renderizar o cronograma inteiro (360 linhas) é exatamente o
 * defeito que esta função existe pra impedir de voltar.
 */

interface NumberedInstallment {
  readonly number: number
}

export const VISIBLE_INSTALLMENTS = 4

/** How many of the visible rows are the most recent Pagas (Figma `91:100`/`91:108`). */
const PAID_CONTEXT_ROWS = 2

export interface InstallmentWindow<T> {
  readonly visible: readonly T[]
  /** Parcelas after the window — the "... N parcelas restantes" line. 0 hides it. */
  readonly remaining: number
}

export function windowInstallments<T extends NumberedInstallment>(
  installments: readonly T[],
  paidCount: number,
): InstallmentWindow<T> {
  const sorted = [...installments].sort((a, b) => a.number - b.number)
  if (sorted.length <= VISIBLE_INSTALLMENTS) {
    return { visible: sorted, remaining: 0 }
  }

  // "hoje" = parcelas pagas + 1, 0-based — or the last one on a debt already
  // quitada (files_design/08 §3.6, same anchor the chart uses).
  const todayIndex = Math.min(paidCount, sorted.length - 1)
  const start = Math.min(
    Math.max(0, todayIndex - PAID_CONTEXT_ROWS),
    sorted.length - VISIBLE_INSTALLMENTS,
  )
  const end = start + VISIBLE_INSTALLMENTS

  return { visible: sorted.slice(start, end), remaining: sorted.length - end }
}

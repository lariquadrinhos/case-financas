'use client'

import { InfoTooltip } from './info-tooltip'

/**
 * A ajuda de cada termo, escrita UMA vez.
 *
 * O Figma desenha o "i" de ajuda em quatro campos do Novo Lançamento — Status,
 * Classificação, Tipo de valor e Sub-tipo —, os que têm opções que o rótulo
 * sozinho não explica (Wireframe `71:11`). Mas os mesmos termos aparecem como
 * rótulo de campo em outras telas, e lá o "i" não existia: **a pessoa que testou
 * o app reparou.** Um termo que precisa de explicação numa tela precisa da mesma
 * explicação em todas.
 *
 * Por isso a cópia mora aqui e não em cada tela. Sete cópias iguais divergem na
 * primeira vez que alguém editar uma delas, e aí o mesmo termo passa a dizer
 * coisas diferentes conforme a tela — que é pior do que não ter ajuda nenhuma.
 *
 * **Onde NÃO entra, medido em 2026-09-11:** onde o termo é o texto do próprio
 * controle e não um rótulo ao lado dele. São dois casos, e os dois foram
 * decididos: o cabeçalho de coluna das tabelas (DRE, Histórico, Destinar o
 * Lucro), onde a pessoa lê um valor já escolhido; e os chips de filtro do
 * Histórico (`773:4` na Mockup, 86×36, "Status ▾"), onde o termo É o gatilho —
 * um "i" ali faria do chip um controle com dois alvos, sete vezes na mesma fila.
 */

/**
 * "Pago" é o rótulo genérico; a aba Receita diz "Recebido" (files_design/01
 * §5.1b, `LABEL_STATUS`). Quem tem um tipo de lançamento em mãos passa o dele.
 */
export function StatusFieldHelp({ paidLabel = 'Pago' }: { paidLabel?: string }) {
  return (
    <InfoTooltip label="Ajuda sobre Status">
      <p>
        Previsto: ainda não aconteceu, ainda não entra nos relatórios (compra no crédito, por
        exemplo).
      </p>
      <p className="mt-8">{paidLabel}: já aconteceu, passa a contar no mês.</p>
    </InfoTooltip>
  )
}

/**
 * `withSuggestionNote` acompanha o rótulo: os campos escritos "Classificação
 * (sugerida)" têm sugestão automática e dizem que ela é editável; onde o rótulo
 * é só "Classificação", não há sugestão e a frase seria mentira.
 */
export function ClassificationFieldHelp({
  withSuggestionNote = false,
}: {
  withSuggestionNote?: boolean
}) {
  return (
    <InfoTooltip label="Ajuda sobre Classificação">
      <p>Circulante: previsto para até 12 meses.</p>
      <p className="mt-8">Não circulante: prazo maior que 12 meses.</p>
      {withSuggestionNote ? (
        <p className="mt-8">Sugestão automática pode ser trocada manualmente a qualquer momento.</p>
      ) : null}
    </InfoTooltip>
  )
}

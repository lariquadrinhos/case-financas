/**
 * Evento de rastreabilidade — turning what happened into the frozen pt-BR
 * sentence the person reads later (files_design/03 "Evento
 * (histórico/rastreabilidade)").
 *
 * The description is generated ONCE, here, and stored as text
 * (`TraceEvent.description`) rather than recomputed from the referenced
 * Passivo or Recorrência every time it is displayed — files_design/03 says so
 * explicitly: "Stored as text so an old event still reads the way it read the
 * day it happened, even after the debt changed." A taxa reajustada three times
 * since must not rewrite what event #1 said.
 *
 * This is why formatting money and percentages happens in the DOMAIN here,
 * against every other rule in this codebase ("o domínio não formata para
 * tela" — GLOSSARY "Núcleo"): the formatted string IS the stored value, not a
 * presentation of it. A screen never re-renders these numbers; it prints the
 * sentence.
 */

import { formatMoney, formatPercent, subtract } from '@/domain/core'
import type { NewTraceEvent, TransferEventData } from './types'
import type {
  DiscrepancyEventData,
  InstallmentPaidEventData,
  RateAdjustmentEventData,
  RecurrencePaidEventData,
  RegistrationEventData,
  TraceEventData,
  TraceEventKind,
  TraceEventOrigin,
} from './types'

/** A monthly rate as a decimal fraction (0.008) rendered as "0,80%" (files_design/03). */
function formatMonthlyRate(rate: number): string {
  return formatPercent(rate * 100, 2)
}

/**
 * "Dívida cadastrada: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m."
 * — Figma `91:145`, o Detalhe do Passivo.
 *
 * P35: o Figma desenha DUAS redações do mesmo evento. O `91:145` diz "Dívida
 * cadastrada"; o `150:20` da Home diz "Financiamento apartamento cadastrado".
 * O que se GRAVA é esta, a curta, e a Home monta a dela na hora com o nome
 * atual do Passivo (`describeEventForHome`). Ver a decisão em
 * docs/PERGUNTAS-EM-ABERTO.md P35.
 */
export function describeRegistration(
  data: Pick<RegistrationEventData, 'originalAmount' | 'installmentCount' | 'initialRate'>,
): string {
  return (
    `Dívida cadastrada: ${formatMoney(data.originalAmount)}, ` +
    `${data.installmentCount} parcelas, taxa inicial ${formatMonthlyRate(data.initialRate)} a.m.`
  )
}

/** "Taxa de juros reajustada de 0,80% para 0,85% a.m." (files_design/03). */
export function describeRateAdjustment(data: RateAdjustmentEventData): string {
  return (
    `Taxa de juros reajustada de ${formatMonthlyRate(data.previousRate)} para ` +
    `${formatMonthlyRate(data.newRate)} a.m.`
  )
}

/**
 * Two wordings depending on whether the payment matched the plan:
 * "Parcela #11 paga: valor conforme previsto" when it did (Figma 150:17),
 * "Parcela #12 paga: previsto R$ 1.520,00, pago R$ 1.540,00 (divergência de
 * R$ 20,00)" when it did not (Figma `91:136`, o Detalhe do Passivo).
 *
 * P35: o sufixo de divergência é do Detalhe — o `150:11` da Home desenha a
 * mesma linha sem ele, e a decisão de 2026-09-09 manteve assim. Ele fica no
 * texto GRAVADO porque o Detalhe é a redação canônica; é a Home que tira, em
 * `describeEventForHome`, junto com o nome que ela acrescenta.
 */
export function describeInstallmentPaid(data: InstallmentPaidEventData): string {
  const prefix = `Parcela #${data.installmentNumber} paga`
  if (data.paidAmount === data.plannedAmount) {
    return `${prefix}: valor conforme previsto`
  }
  const gap =
    data.paidAmount > data.plannedAmount
      ? subtract(data.paidAmount, data.plannedAmount)
      : subtract(data.plannedAmount, data.paidAmount)
  return (
    `${prefix}: previsto ${formatMoney(data.plannedAmount)}, ` +
    `pago ${formatMoney(data.paidAmount)} (divergência de ${formatMoney(gap)})`
  )
}

/**
 * `RecurrencePaidEventData` carries no planned/paid pair — an occurrence paid
 * WITH a divergence is a `Discrepancy`, never a `RecurrencePaid` (files_design/03
 * "Marcar Pago"). So this kind only ever describes the exact-match case.
 *
 * P17 used to claim here that "no source prints a Recorrência paga sentence".
 * Half false, and the false half was the divergent variant: Figma prints it
 * verbatim in `150:8` (see `describeDiscrepancy`). What no frame draws is only
 * the EXACT-MATCH recorrência.
 *
 * **A forma mudou em 2026-09-11, fechando a P17, e não pelo motivo que a
 * pergunta esperava.** A frase era "<assunto> pago: valor conforme previsto",
 * montada da cabeça do `150:8` com a cauda do `150:17`. Só que o assunto vem de
 * `entrySubject`, que devolve o NOME DA CATEGORIA — e colar "pago" nele quebra
 * a concordância em **12 das 39 categorias padrão**: "Academia pago",
 * "Alimentação pago", "Assinaturas e ferramentas pago". O frame funcionava por
 * acaso, porque "Aluguel" é masculino singular; uma categoria criada pela
 * pessoa pode ser qualquer coisa.
 *
 * O nome passou a vir antes de um travessão, e o particípio deixou de tocar
 * nele. `describeInstallmentPaid` NÃO mudou: "Parcela #11 paga" concorda porque
 * "Parcela" é palavra fixa, não nome de categoria.
 */
export function describeRecurrencePaid(data: RecurrencePaidEventData): string {
  return `${data.subject} — pagamento conforme o previsto`
}

/**
 * "Aluguel pago com divergência: previsto R$ 1.500,00, pago R$ 1.300,00
 * (R$ 200,00 pendente)" — Figma, card "Eventos Recentes" da Home: Wireframe
 * `150:8` e Mockup `549:282`, palavra por palavra. As duas páginas concordam, e
 * o mesmo texto se repete nos 11 frames do Wireframe que desenham esse card
 * (`262:1107`, `262:780`, `262:459`, `262:212`, `347:214`, `347:439`,
 * `347:664`, `347:889`, `347:1114`, `349:238`).
 *
 * O sufixo faltava porque o código seguiu o exemplo de files_design/03, que
 * corta a frase no "pago R$ 1.300,00" — é uma lista de "ex.:", não a redação
 * completa. Medido: previsto 150000c − pago 130000c = 20000c, exatamente o
 * "R$ 200,00" que o frame imprime, e exatamente o valor que vira item do card
 * de Pendências (nota `163:4`). Sem o sufixo, a linha do Evento não diz quanto
 * ficou devendo, que é o elo entre os dois cards da mesma tela.
 *
 * Só aparece quando pago < previsto: files_design/03 §"Marcar Pago" diz que
 * pago > previsto "nunca vira Pendência", logo não há nada pendente para
 * anunciar — e nenhum frame desenha sufixo nesse caso.
 *
 * **A cabeça da frase mudou em 2026-09-11** (P17): era "<assunto> pago com
 * divergência", e o assunto é o nome da categoria, então "Academia pago com
 * divergência" saía errado em 12 das 39 categorias padrão. Os 36 textos da
 * Mockup foram atualizados junto. Ver `describeRecurrencePaid`.
 */
export function describeDiscrepancy(data: DiscrepancyEventData): string {
  const sentence =
    `${data.subject} — pagamento com divergência: previsto ${formatMoney(data.plannedAmount)}, ` +
    `pago ${formatMoney(data.paidAmount)}`
  if (data.paidAmount >= data.plannedAmount) {
    return sentence
  }
  return `${sentence} (${formatMoney(subtract(data.plannedAmount, data.paidAmount))} pendente)`
}

/**
 * A redação da Home a partir da gravada — P35, decidido em 2026-09-09.
 *
 * O MESMO evento é desenhado de dois jeitos: o Detalhe do Passivo já tem o nome
 * da dívida no título da tela e não o repete na linha; a Home não tem contexto
 * nenhum e precisa dele dentro da frase. Grava-se a forma do Detalhe e a Home
 * monta a sua com o nome ATUAL do Passivo — o que significa que renomear a
 * dívida muda o que a Home mostra para eventos antigos. É a consequência
 * aceita na decisão: a alternativa era gravar duas frases.
 *
 * Só os três tipos de origem Passivo transformam. `RecurrencePaid` e
 * `Discrepancy` já nascem com o assunto na frase (Figma `150:8`), porque a
 * Recorrência não tem tela de detalhe onde o nome ficaria redundante.
 *
 * As trocas são ancoradas em texto que ESTE arquivo gerou, nunca em texto
 * livre, e quando a âncora não casa a frase gravada passa inteira: um evento
 * antigo, escrito por uma versão anterior, nunca vira frase quebrada.
 */
export function describeEventForHome(
  kind: TraceEventKind,
  description: string,
  subject: string | null,
): string {
  if (subject === null) return description
  switch (kind) {
    // "Dívida cadastrada: …" → "Financiamento apartamento cadastrado: …" (150:20).
    case 'Registration':
      return description.startsWith('Dívida cadastrada:')
        ? `${subject} cadastrado:${description.slice('Dívida cadastrada:'.length)}`
        : description
    // "Taxa de juros reajustada de …" → "Taxa de juros DO <nome> reajustada de …" (150:14).
    case 'RateAdjustment':
      return description.startsWith('Taxa de juros reajustada')
        ? `Taxa de juros do ${subject} reajustada${description.slice('Taxa de juros reajustada'.length)}`
        : description
    // "Parcela #12 paga: …" → "Parcela #12 DO <nome> paga: …" (150:11), e sem o
    // sufixo de divergência, que o 150:11 não desenha.
    case 'InstallmentPaid': {
      const match = /^(Parcela #\d+) paga(.*)$/s.exec(description)
      if (match === null) return description
      const head = match[1] ?? ''
      const tail = match[2] ?? ''
      return `${head} do ${subject} paga${tail.replace(/ \(divergência de [^)]+\)$/, '')}`
    }
    default:
      return description
  }
}

/**
 * "R$ 5.000,00 redirecionados de Nubank para Tesouro Direto" — ADR-0017 §3.
 *
 * A forma segue as três descrições que o `files_design/03` escreve por extenso:
 * começa pela coisa e depois diz o que aconteceu ("Taxa de juros reajustada
 * de…", "Parcela #12 paga: …"). O verbo é o do botão que a pessoa clicou,
 * "Redirecionar valor", e não o nome do conceito no domínio.
 *
 * Várias origens acontecem num bloco agregado de Onde Está Meu Dinheiro: tirar
 * R$ 30.000 de "Investimentos" sai de mais de um instrumento.
 */
export function describeTransfer(data: TransferEventData): string {
  const origens =
    data.sourceNames.length <= 1
      ? (data.sourceNames[0] ?? '')
      : `${data.sourceNames.slice(0, -1).join(', ')} e ${data.sourceNames[data.sourceNames.length - 1]}`
  return `${formatMoney(data.amount)} redirecionados de ${origens} para ${data.destinationName}`
}

/** Which describe function goes with which kind — kept in one place so a new kind cannot skip it. */
const DESCRIBERS: { readonly [K in TraceEventKind]: (data: TraceEventData<K>) => string } = {
  Registration: describeRegistration,
  RateAdjustment: describeRateAdjustment,
  InstallmentPaid: describeInstallmentPaid,
  RecurrencePaid: describeRecurrencePaid,
  Discrepancy: describeDiscrepancy,
  Transfer: describeTransfer,
}

export function describeEvent<K extends TraceEventKind>(kind: K, data: TraceEventData<K>): string {
  return DESCRIBERS[kind](data)
}

/**
 * Assembles a `NewTraceEvent` the way every caller needs it: the person never
 * writes the description by hand, and the store — not this function — assigns
 * the id (src/domain/README.md, "a store stamps id and timestamp at the edge").
 */
export function buildTraceEvent<K extends TraceEventKind>(
  kind: K,
  origin: TraceEventOrigin,
  data: TraceEventData<K>,
): NewTraceEvent {
  return { date: data.date, kind, origin, description: describeEvent(kind, data) }
}

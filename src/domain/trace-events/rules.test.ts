import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate } from '@/domain/core'
import type { LiabilityId, RecurrenceId, TraceEventId } from '@/domain/core'
import {
  buildTraceEvent,
  describeDiscrepancy,
  describeInstallmentPaid,
  describeRateAdjustment,
  describeRecurrencePaid,
  describeEventForHome,
  describeRegistration,
} from './rules'

const LIABILITY = asId<LiabilityId>('financiamento-apartamento')
const RECURRENCE = asId<RecurrenceId>('aluguel')
const EVENT_ID = asId<TraceEventId>('evt-1')
const DATE = isoDate('2026-07-20')

/**
 * `Intl.NumberFormat('pt-BR', { style: 'currency' })` puts a non-breaking
 * space (U+00A0) after "R$", invisible in a diff. Same normalisation as
 * `src/domain/core/money.test.ts`.
 */
function plainSpaces(text: string): string {
  return text.replace(/ /g, ' ')
}

describe('describeRegistration — Figma 91:145', () => {
  it('P35 — grava a forma do Detalhe do Passivo, sem o nome da dívida', () => {
    expect(
      plainSpaces(
        describeRegistration({
          originalAmount: cents(32_000_000),
          installmentCount: 360,
          initialRate: 0.008,
        }),
      ),
    ).toBe('Dívida cadastrada: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m.')
  })
})

describe('describeEventForHome — P35, a redação da Home a partir da gravada', () => {
  it('Figma 150:20 — o Cadastro troca "Dívida" pelo nome, com a concordância certa', () => {
    const stored = describeRegistration({
      originalAmount: cents(32_000_000),
      installmentCount: 360,
      initialRate: 0.008,
    })
    expect(
      plainSpaces(describeEventForHome('Registration', stored, 'Financiamento apartamento')),
    ).toBe(
      'Financiamento apartamento cadastrado: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m.',
    )
  })

  it('Figma 150:14 — o Reajuste ganha "do <nome>" no meio da frase', () => {
    const stored = describeRateAdjustment({
      id: EVENT_ID,
      date: DATE,
      previousRate: 0.008,
      newRate: 0.0085,
    })
    expect(describeEventForHome('RateAdjustment', stored, 'Financiamento apartamento')).toBe(
      'Taxa de juros do Financiamento apartamento reajustada de 0,80% para 0,85% a.m.',
    )
  })

  it('Figma 150:11 — a Parcela ganha o nome E perde o sufixo de divergência, que é só do Detalhe', () => {
    const stored = describeInstallmentPaid({
      id: EVENT_ID,
      date: DATE,
      installmentNumber: 12,
      plannedAmount: cents(152_000),
      paidAmount: cents(154_000),
    })
    expect(plainSpaces(stored)).toBe(
      'Parcela #12 paga: previsto R$ 1.520,00, pago R$ 1.540,00 (divergência de R$ 20,00)',
    )
    expect(
      plainSpaces(describeEventForHome('InstallmentPaid', stored, 'Financiamento apartamento')),
    ).toBe('Parcela #12 do Financiamento apartamento paga: previsto R$ 1.520,00, pago R$ 1.540,00')
  })

  it('sem assunto, ou com uma frase que a âncora não reconhece, o texto gravado passa inteiro', () => {
    expect(describeEventForHome('Registration', 'Frase de uma versão antiga', null)).toBe(
      'Frase de uma versão antiga',
    )
    expect(describeEventForHome('Registration', 'Frase de uma versão antiga', 'Dívida X')).toBe(
      'Frase de uma versão antiga',
    )
  })

  it('Recorrência e Divergência não transformam: já nascem com o assunto na frase (150:8)', () => {
    const stored = describeRecurrencePaid({ id: EVENT_ID, date: DATE, subject: 'Aluguel' })
    expect(describeEventForHome('RecurrencePaid', stored, 'Aluguel')).toBe(stored)
  })
})

describe('describeRateAdjustment — files_design/03', () => {
  it('matches the exact wording of the spec example', () => {
    expect(
      describeRateAdjustment({ id: EVENT_ID, date: DATE, previousRate: 0.008, newRate: 0.0085 }),
    ).toBe('Taxa de juros reajustada de 0,80% para 0,85% a.m.')
  })
})

describe('describeInstallmentPaid — two wordings by whether it diverged', () => {
  it('says "valor conforme previsto" when paid matches planned (Figma 150:17)', () => {
    expect(
      describeInstallmentPaid({
        id: EVENT_ID,
        date: DATE,
        installmentNumber: 11,
        plannedAmount: cents(152_000),
        paidAmount: cents(152_000),
      }),
    ).toBe('Parcela #11 paga: valor conforme previsto')
  })

  it('Figma 91:136 — soletra os dois valores E a diferença quando divergem', () => {
    expect(
      plainSpaces(
        describeInstallmentPaid({
          id: EVENT_ID,
          date: DATE,
          installmentNumber: 12,
          plannedAmount: cents(152_000),
          paidAmount: cents(154_000),
        }),
      ),
    ).toBe('Parcela #12 paga: previsto R$ 1.520,00, pago R$ 1.540,00 (divergência de R$ 20,00)')
  })
})

describe('describeRecurrencePaid — P17, mirrors the exact-match wording of Parcela paga', () => {
  it('names the recurrence instead of a parcel number', () => {
    expect(describeRecurrencePaid({ id: EVENT_ID, date: DATE, subject: 'Aluguel' })).toBe(
      'Aluguel — pagamento conforme o previsto',
    )
  })
})

describe('describeDiscrepancy — Figma 150:8', () => {
  it('closes with the amount still pending when paid < planned (Figma 150:8, Mockup 549:282)', () => {
    expect(
      plainSpaces(
        describeDiscrepancy({
          id: EVENT_ID,
          date: DATE,
          subject: 'Aluguel',
          plannedAmount: cents(150_000),
          paidAmount: cents(130_000),
        }),
      ),
    ).toBe(
      'Aluguel — pagamento com divergência: previsto R$ 1.500,00, pago R$ 1.300,00 (R$ 200,00 pendente)',
    )
  })

  it('omits the pending suffix when paid > planned, because nothing is pending (files_design/03 §"Marcar Pago")', () => {
    expect(
      plainSpaces(
        describeDiscrepancy({
          id: EVENT_ID,
          date: DATE,
          subject: 'Aluguel',
          plannedAmount: cents(150_000),
          paidAmount: cents(170_000),
        }),
      ),
    ).toBe('Aluguel — pagamento com divergência: previsto R$ 1.500,00, pago R$ 1.700,00')
  })
})

describe('buildTraceEvent — assembles a NewTraceEvent without inventing an id', () => {
  it('carries the origin, the date of the fact and the generated description', () => {
    const event = buildTraceEvent(
      'RateAdjustment',
      { kind: 'Liability', liabilityId: LIABILITY },
      { id: EVENT_ID, date: DATE, previousRate: 0.008, newRate: 0.0085 },
    )
    expect(event).toEqual({
      date: DATE,
      kind: 'RateAdjustment',
      origin: { kind: 'Liability', liabilityId: LIABILITY },
      description: 'Taxa de juros reajustada de 0,80% para 0,85% a.m.',
    })
    expect(event).not.toHaveProperty('id')
  })

  it('works the same way with a Recurrence origin', () => {
    const event = buildTraceEvent(
      'RecurrencePaid',
      { kind: 'Recurrence', recurrenceId: RECURRENCE },
      { id: EVENT_ID, date: DATE, subject: 'Aluguel' },
    )
    expect(event.origin).toEqual({ kind: 'Recurrence', recurrenceId: RECURRENCE })
    expect(event.description).toBe('Aluguel — pagamento conforme o previsto')
  })
})

/**
 * P17, fechada em 2026-09-11 — e não pela redação que a pergunta esperava.
 *
 * A pergunta era "qual o texto da recorrência paga SEM divergência", já que
 * nenhum frame a desenha. Medindo para responder, apareceu um problema maior
 * nas DUAS frases: elas colavam "pago" num nome de categoria qualquer, e o
 * assunto vem de `entrySubject`, que devolve o nome da categoria. Das 39
 * categorias padrão, **12 quebram a concordância** — "Academia pago",
 * "Alimentação pago", "Assinaturas e ferramentas pago".
 *
 * O frame desenhava "Aluguel pago com divergência" e funcionava por acaso:
 * "Aluguel" é masculino singular. Uma categoria criada pela pessoa pode ser
 * qualquer coisa.
 *
 * A forma nova põe o nome antes de um travessão, e o particípio deixa de tocar
 * nele. A de PARCELA não mudou: "Parcela #11 paga" concorda porque "Parcela" é
 * fixo, não é nome de categoria.
 */
describe('P17 — a frase sobrevive a qualquer nome de categoria', () => {
  const FEMININAS = ['Academia', 'Alimentação', 'Assinaturas e ferramentas', 'Educação']

  it.each(FEMININAS)('%s — sem divergência, sem erro de concordância', (assunto) => {
    const frase = describeRecurrencePaid({
      id: asId<TraceEventId>('e1'),
      date: isoDate('2026-07-10'),
      subject: assunto,
    })
    expect(frase).toBe(`${assunto} — pagamento conforme o previsto`)
    // A armadilha antiga, explicitamente: nada de "<nome> pago".
    expect(frase).not.toMatch(new RegExp(`${assunto} pago`))
  })

  it.each(FEMININAS)('%s — com divergência, idem', (assunto) => {
    const frase = describeDiscrepancy({
      id: asId<TraceEventId>('e2'),
      date: isoDate('2026-07-10'),
      subject: assunto,
      plannedAmount: cents(150000),
      paidAmount: cents(130000),
    })
    expect(frase).toContain(`${assunto} — pagamento com divergência:`)
    expect(frase).not.toMatch(new RegExp(`${assunto} pago`))
  })
})

/**
 * `GET, PATCH, DELETE /api/v1/liabilities/{id}`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import { buildInstallmentSchedule } from '@/domain/assets'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { DELETE, GET, PATCH } from './route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET, PATCH, DELETE /api/v1/liabilities/{id}', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seed() {
    return handle.repositories.liabilityWriter.create(TEST_USER_ID, {
      name: 'Financiamento apartamento',
      creditor: 'Banco X',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32000000),
      installmentAmount: cents(150000),
      installmentCount: 12,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.008,
      startDate: isoDate('2026-01-10'),
    })
  }

  it('GET reads it back; 404 for an unknown id', async () => {
    const liability = await seed()
    const ok = await GET(
      new Request(`https://x/api/v1/liabilities/${liability.id}`),
      context(liability.id),
    )
    expect(ok.status).toBe(200)

    const missing = await GET(new Request('https://x/api/v1/liabilities/ghost'), context('ghost'))
    expect(missing.status).toBe(404)
  })

  it('PATCH edits cadastro fields ("Editar dados cadastrais") without touching the schedule', async () => {
    const liability = await seed()
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/liabilities/${liability.id}`, { creditor: 'Banco Novo' }),
      context(liability.id),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      creditor: 'Banco Novo',
      name: liability.name,
    })
  })

  /**
   * files_design/02, "Expansão de escopo: análise completa de Passivos":
   * "se a pessoa quer mudar os valores das parcelas futuras, o caminho
   * correto é a causa raiz, a taxa de juros, não um valor calculado" — a
   * mudança de taxa só é válida pela rota dedicada de reajuste
   * (`POST /liabilities/{id}/rate-adjustments`, que recalcula o cronograma),
   * nunca por este PATCH genérico — a legenda `91:98` do Wireframe `91:2`
   * (Mockup `949:72`) nomeia o reajuste como o único gatilho de recálculo
   * (PERGUNTAS-EM-ABERTO P24, respondida).
   */
  it('rejects a PATCH carrying monthlyInterestRate with 422 (rate change only via rate-adjustments)', async () => {
    const liability = await seed()

    const response = await PATCH(
      jsonRequest(`https://x/api/v1/liabilities/${liability.id}`, { monthlyInterestRate: 0.02 }),
      context(liability.id),
    )

    expect(response.status).toBe(422)
    const stored = await handle.repositories.liabilityReader.findById(TEST_USER_ID, liability.id)
    expect(stored?.monthlyInterestRate).toBe(0.008)
  })

  /**
   * Os quatro campos que DÃO FORMA ao cronograma — "Valor original da dívida",
   * "Número de parcelas", "Parcelas já pagas" e "Data de início" — são as
   * entradas de `buildInstallmentSchedule`, e o desenho não tem por onde
   * regenerá-lo por aqui: o único gatilho de recálculo que alguma fonte nomeia
   * é o reajuste de juros (Wireframe `91:2` nó `91:98` / Mockup `948:1687` nó
   * `949:72`: "Recalculado a cada reajuste de juros registrado").
   */
  it.each([
    ['originalAmount', { originalAmount: 40000000 }],
    ['installmentCount', { installmentCount: 400 }],
    ['installmentsAlreadyPaid', { installmentsAlreadyPaid: 3 }],
    ['startDate', { startDate: '2027-03-10' }],
  ])(
    'rejects a PATCH carrying %s with 422 (schedule shape only changes at cadastro, Figma 91:98)',
    async (_field, body) => {
      const liability = await seed()
      await handle.repositories.installmentWriter.replaceSchedule(
        TEST_USER_ID,
        liability.id,
        buildInstallmentSchedule(liability),
      )

      const response = await PATCH(
        jsonRequest(`https://x/api/v1/liabilities/${liability.id}`, body),
        context(liability.id),
      )

      expect(response.status).toBe(422)
      const stored = await handle.repositories.liabilityReader.findById(TEST_USER_ID, liability.id)
      expect(stored).toMatchObject({
        originalAmount: 32000000,
        installmentCount: 12,
        installmentsAlreadyPaid: 0,
        startDate: '2026-01-10',
      })
      const schedule = await handle.repositories.installmentReader.listByLiability(
        TEST_USER_ID,
        liability.id,
      )
      expect(schedule).toHaveLength(12)
    },
  )

  /**
   * Este teste afirmava o contrário — que o DELETE responde 409 "enquanto o
   * cronograma existir", com o RESTRICT como justificativa. Ele travava um
   * DEFEITO como se fosse regra: `POST /liabilities` gera o cronograma no
   * cadastro, então o cronograma existe SEMPRE, e o "Descartar" da tela de
   * Passivos nunca funcionava. Medido contra a base sintética antes da
   * correção: 409 em 100% dos casos.
   *
   * O RESTRICT continua certo — ele protege contra quem aponta de FORA. O que
   * mudou é que o `remove` do repositório passou a apagar o que é DO passivo
   * (cronograma, reajustes e eventos) dentro da mesma transação, como o
   * `remove` de `discretionary-spending.repository.ts` já fazia com a linha
   * lateral dele.
   */
  it('DELETE apaga o passivo COM o cronograma dele, que existe desde o cadastro', async () => {
    const liability = await seed()
    await handle.repositories.installmentWriter.replaceSchedule(TEST_USER_ID, liability.id, [
      {
        id: `${liability.id}#1` as never,
        liabilityId: liability.id,
        number: 1,
        plannedDate: isoDate('2026-02-10'),
        plannedAmount: cents(150000),
        status: 'Planned',
        paidAmount: null,
        paidDate: null,
        discarded: false,
      },
    ])

    const response = await DELETE(
      new Request(`https://x/api/v1/liabilities/${liability.id}`, { method: 'DELETE' }),
      context(liability.id),
    )
    expect(response.status).toBe(204)

    const schedule = await handle.repositories.installmentReader.listByLiability(
      TEST_USER_ID,
      liability.id,
    )
    expect(schedule).toEqual([])
  })

  it('DELETE answers 404 for an unknown id', async () => {
    const response = await DELETE(
      new Request('https://x/api/v1/liabilities/ghost', { method: 'DELETE' }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })
  /*
   * The old "pair rule on the MERGED Passivo" case lived here: a PATCH could
   * push "Parcelas já pagas" above "Número de parcelas". Neither field reaches
   * this route any more (see the `it.each` above), so the pair is checked only
   * where it can still arrive — cadastro, covered by `../route.test.ts`
   * ("rejects installmentsAlreadyPaid above installmentCount with 422") and by
   * `src/domain/assets/installments.test.ts`.
   */
})

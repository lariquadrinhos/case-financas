import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LABEL_TRACE_EVENT_KIND, TRACE_EVENT_KINDS } from './types'

/**
 * O rótulo de cada tipo de Evento não é escolha nossa: as duas fontes que o
 * nomeiam existem e foram medidas.
 *
 * 1. `files_design/03` §"Evento (histórico/rastreabilidade)" enumera QUATRO
 *    tipos, literalmente: "enum: Cadastro, Reajuste de juros, Parcela paga,
 *    Recorrência paga".
 * 2. O quinto (`Discrepancy`) vem da generalização registrada na nota do Figma
 *    `163:4` ("Qualquer divergência (previsto ≠ pago) ... gera um Evento") e em
 *    `files_design/03` §"Marcar Pago" ("gera um Evento de divergência"). O nome
 *    dele estava marcado no código como "à espera da redação de Produto" —
 *    ALEGAÇÃO FALSA, medida aqui: o Wireframe escreve a taxonomia por extenso no
 *    estado vazio `309:23`, nó de texto `309:25`, "Reajustes de juros,
 *    **divergências de pagamento** e parcelas confirmadas aparecem aqui conforme
 *    forem acontecendo."
 *
 * Por isso o esperado é DERIVADO do XML do frame, não digitado aqui: se o
 * desenho mudar o termo, o teste cai junto.
 *
 * INVERSÃO VERIFICADA: com o valor anterior (`Discrepancy: 'Divergência'`, ver
 * `git show HEAD:src/domain/trace-events/types.ts`) o primeiro teste fica
 * vermelho — esperado "Divergência de pagamento", recebido "Divergência".
 */
const FRAME_309_23 = readFileSync(
  path.join(process.cwd(), 'docs/figma/frames/309-23__vazio-eventos-recentes.xml'),
  'utf8',
)

describe('LABEL_TRACE_EVENT_KIND', () => {
  it('Figma 309:25 — o rótulo de Discrepancy é o termo que o estado vazio de Eventos Recentes escreve por extenso', () => {
    // O frame escreve a taxonomia no plural; o rótulo do enum é o singular dela.
    const match = /Reajustes de juros, ([^,]+?) e parcelas confirmadas/.exec(FRAME_309_23)
    const taxonomyTerm = match?.[1] ?? ''
    expect(taxonomyTerm).toBe('divergências de pagamento')

    const singular = taxonomyTerm.replace('divergências', 'divergência')
    const expected = singular.charAt(0).toUpperCase() + singular.slice(1)

    expect(LABEL_TRACE_EVENT_KIND.Discrepancy).toBe(expected)
  })

  it('files_design/03 §Evento — os tipos enumerados mantêm a redação da especificação', () => {
    const spec = readFileSync(
      path.join(process.cwd(), 'files_design/03-modelo-de-dados-por-tela.md'),
      'utf8',
    )
    const match = /\| Tipo \| enum: ([^|]+?) \|/.exec(spec)
    const documented = (match?.[1] ?? '').split(', ')

    expect(documented).toEqual([
      'Cadastro',
      'Reajuste de juros',
      'Parcela paga',
      'Recorrência paga',
      // ADR-0017 §3, 2026-09-11: a linha "Tipo" do files_design/03 ganhou o
      // quinto valor junto com o código. Continua sendo a especificação que
      // manda — o teste lê o documento e compara, não o contrário.
      'Transferência',
    ])
    expect(
      TRACE_EVENT_KINDS.filter((kind) => kind !== 'Discrepancy').map(
        (kind) => LABEL_TRACE_EVENT_KIND[kind],
      ),
    ).toEqual(documented)
  })
})

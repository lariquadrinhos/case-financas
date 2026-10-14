/**
 * Serialização compartilhada de um Passivo — o único lugar que acrescenta o
 * `outstandingBalance` ao corpo da resposta.
 *
 * Não é rota (o `_` na frente impede o Next de tratar como uma), mesma
 * convenção de `src/app/api/v1/reports/_assemble.ts`.
 *
 * Por que existe: `outstandingBalance` é DERIVADO do cronograma (valor presente
 * das parcelas ainda Previstas, `@/domain/assets`), e o domínio não o guarda de
 * propósito — o `Liability` armazenado tem só os dados de cadastro. Mas a lista
 * de Passivos desenha esse número, não o valor original (Wireframe `40:2`, nó
 * `90:66`), então ele precisa chegar na borda. Concentrar aqui evita que cada
 * uma das quatro rotas que devolvem um Passivo (list, get, post, patch) invente
 * a sua própria versão do cálculo.
 *
 * O N+1 de ler o cronograma por passivo é o MESMO padrão que
 * `reports/_assemble.ts` já usa para montar o patrimônio (`loadPatrimonio`), e
 * pela mesma razão: a quantidade de passivos de uma pessoa é pequena, e o
 * alternativo seria uma consulta agregada que o port não expõe.
 */

import { outstandingBalance, type Liability } from '@/domain/assets'
import { getRepositories } from '@/data'
import type { UserId } from '@/data'

export type SerializedLiability = Liability & { readonly outstandingBalance: number }

export async function serializeLiability(
  userId: UserId,
  liability: Liability,
): Promise<SerializedLiability> {
  const { installmentReader } = getRepositories()
  const installments = await installmentReader.listByLiability(userId, liability.id)
  return {
    ...liability,
    outstandingBalance: outstandingBalance(installments, liability.monthlyInterestRate),
  }
}

export async function serializeLiabilities(
  userId: UserId,
  liabilities: readonly Liability[],
): Promise<SerializedLiability[]> {
  return Promise.all(liabilities.map((liability) => serializeLiability(userId, liability)))
}

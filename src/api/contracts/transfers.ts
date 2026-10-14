/**
 * `POST /api/v1/transfers` — Transferência (ADR-0017 §2).
 *
 * O corpo carrega N origens e UM destino de propósito: um bloco de Onde Está
 * Meu Dinheiro pode ser agregado ("Investimentos" contém Tesouro Direto e Ações
 * XP), e tirar valor dali sai de mais de um instrumento. Mandar N requisições,
 * uma por instrumento, seria o mesmo defeito que esta rota existe para fechar.
 *
 * Passivo não é destino aceito. Não é omissão: redirecionar valor livre para
 * uma dívida é amortização extraordinária, decisão de produto sobre o
 * cronograma que ninguém tomou (ADR-0017, "Explicitamente NÃO feito").
 */

import { z } from 'zod'

import { isoDateSchema, nonNegativeCentsSchema } from './common'

export const transferPositionSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('BankAccount'), bankAccountId: z.string().min(1) }),
    z.object({ kind: z.literal('Investment'), investmentId: z.string().min(1) }),
  ])
  .openapi({ description: 'Uma posição com saldo: conta bancária ou investimento.' })

export const transferSourceSchema = z.object({
  position: transferPositionSchema,
  amount: nonNegativeCentsSchema,
})

export const transferSchema = z
  .object({
    date: isoDateSchema,
    sources: z.array(transferSourceSchema).min(1),
    destination: transferPositionSchema,
    /**
     * Redundante com a soma de `sources`, e de propósito: é o valor que a
     * pessoa digitou. `planTransfer` recusa (`transfer.sources_do_not_sum`)
     * quando os dois discordam, em vez de escolher um em silêncio.
     */
    amount: nonNegativeCentsSchema,
  })
  .openapi({ description: 'Move valor de uma ou mais posições para outra, numa operação só.' })

export type TransferBody = z.infer<typeof transferSchema>

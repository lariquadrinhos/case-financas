/**
 * Uma ocorrência pelo id, gravando-a se a série a gera e ela ainda não foi
 * gravada.
 *
 * Medido em 2026-10-06: o DRE de outubro listava uma assinatura recorrente como a
 * ocorrência `<série>:2026-10`, projetada da série, e o "Editar" da linha abria
 * "Não foi possível carregar este lançamento" — `GET /occurrences/{id}`
 * respondia 404, porque só a visita à Revisão de Recorrentes grava o mês
 * (ADR-0004). O "Confirmar" e o "Descartar" da mesma linha caíam no mesmo 404.
 * O DRE projeta o mês sem gravá-lo; quem age sobre a linha a grava aqui, pelo
 * mesmo `create` idempotente por (série, mês) que a Revisão usa.
 */

import { month, type OccurrenceId, type RecurrenceId } from '@/domain/core'
import { occurrenceOfMonth, type Occurrence } from '@/domain/recurrence'
import type { Repositories } from '@/data'
import type { UserId } from '@/data/contracts/common'

type Repos = Pick<Repositories, 'occurrenceReader' | 'occurrenceWriter' | 'recurrenceReader'>

export async function findOrMaterializeOccurrence(
  repos: Repos,
  userId: UserId,
  id: OccurrenceId,
): Promise<Occurrence | null> {
  const stored = await repos.occurrenceReader.findById(userId, id)
  if (stored !== null) return stored

  // O id de uma ocorrência é `<série>:<YYYY-MM>` (recurrence/engine.ts).
  const colon = id.lastIndexOf(':')
  if (colon <= 0) return null
  let target
  try {
    target = month(id.slice(colon + 1))
  } catch {
    return null
  }
  const recurrence = await repos.recurrenceReader.findById(
    userId,
    id.slice(0, colon) as RecurrenceId,
  )
  if (recurrence === null) return null
  const virtual = occurrenceOfMonth(recurrence, target)
  if (virtual === null || virtual.id !== id) return null
  const { id: _id, ...newOccurrence } = virtual
  return repos.occurrenceWriter.create(userId, newOccurrence)
}

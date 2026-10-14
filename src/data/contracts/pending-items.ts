/**
 * Divergência de pagamento a menor — tipo 4 da Pendência unificada (H13).
 *
 * A `PaymentDiscrepancy` is never created by a client directly: it is written
 * by the payment routes (`POST /entries/{id}/payment`,
 * `POST /occurrences/{id}/payment`) as the policy consequence of an Underpaid
 * outcome (`@/domain/pending-items` `pendingItemFromPaymentOutcome`). The only
 * write a client triggers is `replace`, through "Pagar".
 */

import type {
  PaymentDiscrepancyPendingItem,
  PaymentDiscrepancyStatus,
} from '@/domain/pending-items'
import type { LeftoverDirection } from '@/domain/discretionary-spending'
import type { Month, PaymentDiscrepancyId } from '@/domain/core'
import type { Reader, UserId, Writer } from './common'

export type NewPaymentDiscrepancy = Omit<PaymentDiscrepancyPendingItem, 'id'>

export interface PaymentDiscrepancyReader extends Reader<
  PaymentDiscrepancyPendingItem,
  PaymentDiscrepancyId
> {
  /** Oldest origin date first — same ordering rule as `PendingAllocationReader`. */
  listByStatus(
    userId: UserId,
    status: PaymentDiscrepancyStatus,
  ): Promise<readonly PaymentDiscrepancyPendingItem[]>
}

export type PaymentDiscrepancyWriter = Writer<
  PaymentDiscrepancyPendingItem,
  NewPaymentDiscrepancy,
  PaymentDiscrepancyId
>

/* -------------------------------------------------------------------------
 * Sobra do mês — P14
 * ---------------------------------------------------------------------- */

/**
 * Os direcionamentos da sobra. A Pendência em si NÃO é guardada — ela é
 * `sobra(mês) − soma destes` (`pendingLeftover`), derivada como todo relatório
 * (ADR-0001 §1).
 *
 * Só `create` e `list`: um direcionamento é um fato consumado, não se edita nem
 * se apaga. Corrigir é direcionar de novo, e por isso `Writer` inteiro seria
 * grande demais para o que a tela oferece.
 */
export interface LeftoverDirectionReader {
  list(userId: UserId): Promise<readonly LeftoverDirection[]>
  listByMonth(userId: UserId, month: Month): Promise<readonly LeftoverDirection[]>
}

export interface LeftoverDirectionWriter {
  create(userId: UserId, value: Omit<LeftoverDirection, 'id'>): Promise<LeftoverDirection>
}

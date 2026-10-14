/**
 * `POST /api/v1/payment-discrepancies/{id}/payment` — "Pagar" (files_design/03
 * "Marcar Pago": pago a menos vira Pendência com o botão "Pagar").
 *
 * A ação faz duas coisas, e a segunda foi decidida na P25 (produto,
 * 2026-09-08): resolve a Pendência **e** registra a diferença como Lançamento.
 *
 * Por que registra: a diferença é saída de dinheiro real. A P25 seguiu a P6 —
 * se a parcela de Passivo paga conta no DRE, o complemento de um pagamento a
 * menor também conta, senão o DRE fica curto pela diferença para sempre. O
 * Lançamento novo herda categoria, entidade, classificação e conta do
 * Lançamento de origem, porque é o mesmo gasto sendo completado.
 *
 * Por que a data é HOJE e não a original: regime de caixa (PRD §5) — o dinheiro
 * sai agora. Usar `originDate` reescreveria um mês que a pessoa já fechou, que
 * é o risco que a própria P25 apontava. O Figma desenha "Pagar" como ação
 * direta no card de Pendência (frame `5:2`), sem diálogo que pudesse perguntar
 * a data, então não há data a perguntar.
 *
 * Nasce **Pago**: a ação é o registro de um pagamento que acabou de acontecer.
 */

import { resolvePaymentDiscrepancy } from '@/domain/pending-items'
import { asId, type PaymentDiscrepancyId } from '@/domain/core'
import { todayIsoDate } from '@/lib/clock'
import { getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'payment_discrepancies.pay',
  params: idParams,
  handle: async ({ session, params }) => {
    const { paymentDiscrepancyReader, entryReader } = getRepositories()
    const id = asId<PaymentDiscrepancyId>(params.id)

    const discrepancy = await paymentDiscrepancyReader.findById(session.userId, id)
    if (discrepancy === null) {
      throw new NotFoundError('A divergência de pagamento solicitada não existe.')
    }

    const origem = await entryReader.findById(session.userId, discrepancy.origin.entryId)
    if (origem === null) {
      throw new NotFoundError('O lançamento de origem da divergência não existe.')
    }

    const resolved = resolvePaymentDiscrepancy(discrepancy)

    const stored = await withTransaction(async ({ paymentDiscrepancyWriter, entryWriter }) => {
      const gravado = await paymentDiscrepancyWriter.replace(session.userId, resolved)

      // O complemento só faz sentido sobre um Lançamento que tem Categoria —
      // Pró-labore e Distribuição não têm, e nenhuma fonte descreve divergência
      // neles. Sem categoria, resolve a Pendência e para por aí.
      if ('categoryId' in origem) {
        await entryWriter.create(session.userId, {
          kind: 'Expense',
          amount: discrepancy.shortfall,
          date: todayIsoDate(),
          status: 'Paid',
          recurrenceId: null,
          entity: origem.entity,
          categoryId: origem.categoryId,
          classification: origem.classification,
          bankAccountId: origem.bankAccountId,
        })
      }

      return gravado
    })

    return ok(stored)
  },
})

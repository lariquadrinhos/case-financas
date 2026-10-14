/**
 * A regra pura de uma Transferência — ADR-0017 §2.
 *
 * `planTransfer` não grava: devolve o saldo que cada posição tocada passa a
 * ter. Quem escreve é a rota, dentro de um `withTransaction` (ADR-0014). A
 * separação é o que dá a garantia: a regra recusa a operação INTEIRA antes de
 * qualquer escrita, e a transação garante que as escritas válidas ou acontecem
 * todas ou nenhuma.
 *
 * O defeito que isto fecha estava escrito no código que substitui
 * (`block-detail-modal.tsx`): "não é uma transação atômica de backend, então se
 * uma falhar as anteriores já aconteceram". Com N origens num bloco agregado,
 * uma falha no meio do laço deixava parte do dinheiro debitada e não creditada.
 */

import { add, isZero, isNegative, subtract, type Cents } from '@/domain/core'
import type { PositionBalance, Transfer, TransferLedger, TransferPosition } from './types'

/** Chave estável de uma posição, para comparar e indexar sem depender de ordem. */
function keyOf(position: TransferPosition): string {
  return position.kind === 'BankAccount'
    ? `BankAccount:${position.bankAccountId}`
    : `Investment:${position.investmentId}`
}

export function planTransfer(
  transfer: Transfer,
  ledger: TransferLedger,
): readonly PositionBalance[] {
  if (isZero(transfer.amount) || isNegative(transfer.amount)) {
    throw new Error('transfer.amount_not_positive')
  }
  if (transfer.sources.some((source) => isZero(source.amount) || isNegative(source.amount))) {
    throw new Error('transfer.amount_not_positive')
  }

  const somaDasOrigens = add(...transfer.sources.map((source) => source.amount))
  if (somaDasOrigens !== transfer.amount) {
    throw new Error('transfer.sources_do_not_sum')
  }

  const destino = keyOf(transfer.destination)
  if (transfer.sources.some((source) => keyOf(source.position) === destino)) {
    throw new Error('transfer.same_position')
  }

  const saldos = new Map<string, Cents>()
  for (const { position, balance } of ledger.balances) saldos.set(keyOf(position), balance)

  const exigir = (position: TransferPosition): Cents => {
    const saldo = saldos.get(keyOf(position))
    if (saldo === undefined) throw new Error('transfer.unknown_position')
    return saldo
  }

  // Ordem preservada: a tela lista a Composição na ordem em que debita, e o
  // resultado é conferido contra ela.
  const resultado: PositionBalance[] = []
  for (const source of transfer.sources) {
    const saldo = exigir(source.position)
    // Cada origem responde pelo próprio saldo. Um bloco agregado com total
    // suficiente mas um instrumento estourado é recusa, não rateio: rateio
    // seria inventar uma regra que nenhuma fonte escreve.
    if (source.amount > saldo) throw new Error('transfer.insufficient_balance')
    resultado.push({ position: source.position, balance: subtract(saldo, source.amount) })
  }

  resultado.push({
    position: transfer.destination,
    balance: add(exigir(transfer.destination), transfer.amount),
  })
  return resultado
}

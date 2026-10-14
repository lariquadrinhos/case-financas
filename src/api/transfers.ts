/**
 * Aplicar uma Transferência — a costura entre a regra pura e as portas.
 *
 * Existe porque DUAS rotas movem valor entre posições: `POST /transfers`
 * ("Redirecionar valor", ADR-0017 §2) e `POST /leftover-directions`, onde a
 * sobra do Consumo Livre sai da conta de origem da verba (§4, refinado). Uma
 * segunda cópia do "lê saldo, planeja, grava" seria a segunda cópia de uma
 * regra — o que o SRP deste projeto proíbe (ADR-0013 letra S).
 *
 * O chamador é quem abre a transação: este módulo recebe `repos` já dentro dela
 * e não a abre por conta própria, porque nas duas rotas há outras escritas que
 * têm de cair junto se algo falhar.
 */

import { asId, type TraceEventId } from '@/domain/core'
import { planTransfer } from '@/domain/transfer'
import { buildTraceEvent } from '@/domain/trace-events'
import type { TraceEventOrigin } from '@/domain/trace-events'
import type { Transfer, TransferPosition } from '@/domain/transfer'
import type { Repositories } from '@/data'
import type { UserId } from '@/data/contracts/common'
import { NotFoundError } from './http'

async function balanceOf(
  repos: Repositories,
  userId: UserId,
  position: TransferPosition,
): Promise<{ position: TransferPosition; balance: Awaited<ReturnType<typeof readBalance>> }> {
  return { position, balance: await readBalance(repos, userId, position) }
}

async function readBalance(repos: Repositories, userId: UserId, position: TransferPosition) {
  if (position.kind === 'BankAccount') {
    const conta = await repos.bankAccountReader.findById(userId, position.bankAccountId)
    if (conta === null) throw new NotFoundError('A conta bancária informada não existe.')
    return conta.balance
  }
  const investimento = await repos.investmentReader.findById(userId, position.investmentId)
  if (investimento === null) throw new NotFoundError('O investimento informado não existe.')
  return investimento.accumulatedValue
}

/**
 * Lê os saldos, deixa `planTransfer` decidir, e grava o que ele devolveu.
 *
 * A leitura acontece DENTRO da transação do chamador de propósito: lê-la fora
 * abriria a janela em que outra escrita muda o saldo entre o plano e a
 * gravação — o mesmo defeito, só mais estreito.
 */
export async function applyTransfer(
  repos: Repositories,
  userId: UserId,
  transfer: Transfer,
): Promise<number> {
  const tocadas = [...transfer.sources.map((source) => source.position), transfer.destination]
  const balances = []
  for (const position of tocadas) balances.push(await balanceOf(repos, userId, position))

  const plano = planTransfer(transfer, { balances })

  // ADR-0017 §3 — "toda Transferência grava um Evento", e o Evento nasce AQUI
  // para que a frase seja literal: as duas rotas que movem valor entre posições
  // passam por esta função, e uma delas esquecer seria a diferença entre um
  // movimento rastreável e dois saldos que mudaram sozinhos.
  //
  // Os nomes são lidos AGORA e gravados na descrição: renomear a conta depois
  // não pode reescrever o que aconteceu (mesma regra do `description` de
  // qualquer Evento — src/domain/trace-events/types.ts).
  const nomes: string[] = []
  for (const source of transfer.sources) nomes.push(await nameOf(repos, userId, source.position))
  await repos.traceEventWriter.append(
    userId,
    buildTraceEvent('Transfer', originOf(transfer.destination), {
      // `id` não é usado pela descrição; o store carimba o definitivo ao gravar
      // (src/domain/README.md, "Pureza": a regra não inventa id nem lê relógio).
      id: asId<TraceEventId>(''),
      date: transfer.date,
      amount: transfer.amount,
      sourceNames: nomes,
      destinationName: await nameOf(repos, userId, transfer.destination),
    }),
  )

  for (const { position, balance } of plano) {
    if (position.kind === 'BankAccount') {
      const conta = await repos.bankAccountReader.findById(userId, position.bankAccountId)
      if (conta === null) throw new NotFoundError('A conta bancária informada não existe.')
      await repos.bankAccountWriter.replace(userId, { ...conta, balance })
    } else {
      const investimento = await repos.investmentReader.findById(userId, position.investmentId)
      if (investimento === null) throw new NotFoundError('O investimento informado não existe.')
      await repos.investmentWriter.replace(userId, { ...investimento, accumulatedValue: balance })
    }
  }
  return plano.length
}

/** O nome que a pessoa vê, para congelar na descrição do Evento. */
async function nameOf(
  repos: Repositories,
  userId: UserId,
  position: TransferPosition,
): Promise<string> {
  if (position.kind === 'BankAccount') {
    const conta = await repos.bankAccountReader.findById(userId, position.bankAccountId)
    if (conta === null) throw new NotFoundError('A conta bancária informada não existe.')
    return conta.label
  }
  const investimento = await repos.investmentReader.findById(userId, position.investmentId)
  if (investimento === null) throw new NotFoundError('O investimento informado não existe.')
  return investimento.name
}

/** A origem gravada é o DESTINO — ver `TraceEventOrigin` (ADR-0017 §3). */
function originOf(position: TransferPosition): TraceEventOrigin {
  return position.kind === 'BankAccount'
    ? { kind: 'BankAccount', bankAccountId: position.bankAccountId }
    : { kind: 'Investment', investmentId: position.investmentId }
}

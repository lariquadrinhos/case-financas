import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate } from '@/domain/core'
import type { BankAccountId, InvestmentId } from '@/domain/core'
import { planTransfer } from './rules'
import type { Transfer, TransferLedger, TransferPosition } from './types'

const NUBANK = asId<BankAccountId>('conta-1')
const ITAU = asId<BankAccountId>('conta-2')
const TESOURO = asId<InvestmentId>('inv-1')

const conta = (id: BankAccountId): TransferPosition => ({ kind: 'BankAccount', bankAccountId: id })
const investimento = (id: InvestmentId): TransferPosition => ({
  kind: 'Investment',
  investmentId: id,
})

function razao(...pares: readonly (readonly [TransferPosition, number])[]): TransferLedger {
  return { balances: pares.map(([position, valor]) => ({ position, balance: cents(valor) })) }
}

function transferencia(parcial: Partial<Transfer>): Transfer {
  const sources = parcial.sources ?? [{ position: conta(NUBANK), amount: cents(500000) }]
  return {
    date: isoDate('2026-09-11'),
    sources,
    destination: parcial.destination ?? investimento(TESOURO),
    amount:
      parcial.amount ??
      sources.reduce((s, o) => (s + o.amount) as ReturnType<typeof cents>, cents(0)),
    ...parcial,
  }
}

/**
 * ADR-0017 §2. O que esta suíte protege não é aritmética: é a promessa de que
 * uma transferência é UM fato. Antes dela, `block-detail-modal.tsx` disparava
 * um `PATCH` por lado e o próprio comentário admitia que "se uma falhar as
 * anteriores já aconteceram" — redirecionar R$ 5.000 de uma conta para um
 * investimento podia debitar a conta e nunca creditar o investimento.
 *
 * A regra é pura e não grava nada; quem torna o conjunto atômico é o
 * `withTransaction` (ADR-0014) da rota. O papel daqui é: ou a operação inteira
 * é válida, ou nenhuma posição muda.
 */
describe('planTransfer — ADR-0017 §2', () => {
  it('debita a origem e credita o destino pelo mesmo valor', () => {
    const plano = planTransfer(
      transferencia({ sources: [{ position: conta(NUBANK), amount: cents(500000) }] }),
      razao([conta(NUBANK), 800000], [investimento(TESOURO), 2200000]),
    )

    expect(plano).toEqual([
      { position: conta(NUBANK), balance: cents(300000) },
      { position: investimento(TESOURO), balance: cents(2700000) },
    ])
  })

  it('soma o que sai de vários instrumentos do mesmo bloco agregado', () => {
    const plano = planTransfer(
      transferencia({
        sources: [
          { position: investimento(TESOURO), amount: cents(1000000) },
          { position: conta(ITAU), amount: cents(500000) },
        ],
        destination: conta(NUBANK),
      }),
      razao([investimento(TESOURO), 1000000], [conta(ITAU), 900000], [conta(NUBANK), 100000]),
    )

    expect(plano).toEqual([
      { position: investimento(TESOURO), balance: cents(0) },
      { position: conta(ITAU), balance: cents(400000) },
      { position: conta(NUBANK), balance: cents(1600000) },
    ])
  })

  // O dinheiro não pode nascer nem sumir no caminho: é a invariante que o
  // defeito antigo quebrava por falha de rede, e que aqui é quebrada por
  // aritmética.
  it('recusa quando a soma das origens não bate com o valor', () => {
    expect(() =>
      planTransfer(
        transferencia({
          sources: [{ position: conta(NUBANK), amount: cents(500000) }],
          amount: cents(700000),
        }),
        razao([conta(NUBANK), 800000], [investimento(TESOURO), 0]),
      ),
    ).toThrow('transfer.sources_do_not_sum')
  })

  it('recusa tirar de uma posição mais do que ela tem', () => {
    expect(() =>
      planTransfer(
        transferencia({ sources: [{ position: conta(NUBANK), amount: cents(500000) }] }),
        razao([conta(NUBANK), 300000], [investimento(TESOURO), 0]),
      ),
    ).toThrow('transfer.insufficient_balance')
  })

  it('recusa valor não positivo', () => {
    expect(() =>
      planTransfer(
        transferencia({ sources: [{ position: conta(NUBANK), amount: cents(0) }] }),
        razao([conta(NUBANK), 300000], [investimento(TESOURO), 0]),
      ),
    ).toThrow('transfer.amount_not_positive')
  })

  it('recusa transferir uma posição para ela mesma', () => {
    expect(() =>
      planTransfer(
        transferencia({
          sources: [{ position: conta(NUBANK), amount: cents(500000) }],
          destination: conta(NUBANK),
        }),
        razao([conta(NUBANK), 800000]),
      ),
    ).toThrow('transfer.same_position')
  })

  it('recusa quando uma posição citada não existe no razão', () => {
    expect(() =>
      planTransfer(
        transferencia({ sources: [{ position: conta(ITAU), amount: cents(500000) }] }),
        razao([conta(NUBANK), 800000], [investimento(TESOURO), 0]),
      ),
    ).toThrow('transfer.unknown_position')
  })
})

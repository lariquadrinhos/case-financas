/**
 * Transferência — mover valor entre duas posições que existem (ADR-0017 §1).
 *
 * É o que as telas chamam de "Redirecionar valor" (Onde Está Meu Dinheiro,
 * Detalhe do Consumo Livre). Não confundir com **Direcionamento**
 * (`Allocation`), que aplica a um destino um valor que CHEGA de um evento e não
 * debita ninguém — a diferença está no `src/domain/GLOSSARY.md` e no
 * `files_design/04`, porque os dois verbos parecem sinônimos em português e não
 * são.
 *
 * O que faz de algo uma POSIÇÃO aqui: ter um saldo que a pessoa mantém e que
 * encolhe quando o dinheiro sai. Conta bancária (`balance`) e investimento
 * (`accumulatedValue`) têm; lucro do mês, dinheiro de venda e sobra do Consumo
 * Livre não têm — por isso não aparecem neste tipo.
 *
 * Passivo também não aparece, e não por esquecimento: redirecionar valor livre
 * para uma dívida é amortização extraordinária, decisão de produto sobre o
 * cronograma de parcelas que ninguém tomou (ADR-0017 "Explicitamente NÃO
 * feito"). O Detalhe do Bloco já recusa esse destino dizendo por quê.
 */

import type { BankAccountId, Cents, InvestmentId, IsoDate } from '@/domain/core'

export type TransferPosition =
  | { readonly kind: 'BankAccount'; readonly bankAccountId: BankAccountId }
  | { readonly kind: 'Investment'; readonly investmentId: InvestmentId }

/**
 * De onde sai uma parcela do valor, e quanto.
 *
 * A lista existe porque um bloco de Onde Está Meu Dinheiro pode ser AGREGADO —
 * clicar em "Investimentos" abre um bloco que contém Tesouro Direto e Ações XP.
 * Tirar R$ 30.000 dali sai de mais de um instrumento, e sair de N instrumentos
 * em N requisições seria o mesmo defeito que esta operação existe para fechar.
 */
export interface TransferSource {
  readonly position: TransferPosition
  readonly amount: Cents
}

export interface Transfer {
  readonly date: IsoDate
  readonly sources: readonly TransferSource[]
  readonly destination: TransferPosition
  /** Sempre igual à soma dos `sources` — `planTransfer` recusa se não for. */
  readonly amount: Cents
}

/** O saldo que uma posição passa a ter depois da transferência. */
export interface PositionBalance {
  readonly position: TransferPosition
  readonly balance: Cents
}

/** Saldo de cada posição ANTES da transferência, para a regra poder conferir. */
export interface TransferLedger {
  readonly balances: readonly PositionBalance[]
}

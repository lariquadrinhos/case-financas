'use client'

import { useQueryClient, useMutation } from '@tanstack/react-query'
import { apiPatch, apiPost, apiPut } from '@/lib/api-client'
import type { Cents, Classification, IsoDate, Month } from '@/domain/core'
import type { Allocation } from '@/features/plano-de-contas-e-patrimonio/types'
import type {
  BankAccount,
  DiscretionaryExpense,
  DiscretionarySpendingConfig,
  Entry,
  Investment,
  PendingItem,
} from './queries'

/** "Pagar" — the one action a Divergência de pagamento a menor offers (files_design/03). */
export function usePayDiscrepancy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost<unknown>(`/payment-discrepancies/${id}/payment`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-items'] })
    },
  })
}

/**
 * "Direcionar agora" — resolve um Pendente de Direcionamento (files_design/01
 * §13, files_design/03 "Pendente de Direcionamento": "abre a mesma escolha de
 * conta que aparecia no modal de venda"). `POST /pending-allocations/{id}/
 * allocations` exige que a soma feche exatamente o valor pendente
 * (`directPendingAllocation`, src/domain/assets/pending-allocation-rules.ts) —
 * o formulário do modal garante isso antes de chamar a mutation.
 */
export function useDirectPendingAllocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, allocations }: { id: string; allocations: readonly Allocation[] }) =>
      apiPost<unknown>(`/pending-allocations/${id}/allocations`, { allocations }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-items'] })
    },
  })
}

/** Consumo Livre, Estado A "Configurar" — também reaberto por "Editar valor e conta". */
export function useSaveDiscretionarySpendingConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      monthlyAmount: Cents
      sourceAccountId: string
      entity: 'PF' | 'PJ'
      allowanceKind?: 'Fixed' | 'SourceBalance'
    }) => apiPut<DiscretionarySpendingConfig>('/discretionary-spending/config', body),
    onSuccess: (config) => {
      queryClient.setQueryData(['discretionary-spending', 'config'], config)
    },
  })
}

/** Popover "Gastei um valor" — só o campo Valor (files_design/01 §4a). */
export function useAddDiscretionaryExpense(month: Month) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { amount: Cents; date: IsoDate }) =>
      apiPost<DiscretionaryExpense>('/discretionary-spending/expenses', {
        amount: body.amount,
        date: body.date,
        label: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['discretionary-spending', 'expenses', month],
      })
    },
  })
}

/**
 * Estado C — "Editar" por linha do histórico do widget.
 *
 * Manda Valor E Rótulo porque são exatamente os dois campos editáveis
 * (files_design/03 §"Consumo Livre — widget": "Campos editáveis: Valor, e
 * opcionalmente Rótulo"). Enquanto só o Valor era enviado, o Rótulo era
 * inalcançável pela interface inteira, apesar de existir no contrato Zod
 * (`discretionaryExpensePatchSchema`) e no banco.
 *
 * `label` vai sempre, inclusive `null`: o PATCH distingue `undefined` ("não
 * mandou, preserva") de `null` ("apagou"), e apagar o Rótulo é uma edição
 * válida — ver src/app/api/v1/discretionary-spending/expenses/[id]/route.ts.
 */
export function useEditDiscretionaryExpense(month: Month) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, label }: { id: string; amount: Cents; label: string | null }) =>
      apiPatch<DiscretionaryExpense>(`/discretionary-spending/expenses/${id}`, { amount, label }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['discretionary-spending', 'expenses', month],
      })
    },
  })
}

/**
 * "+ Adicionar gasto em {categoria}" — Detalhe da Categoria (files_design/01
 * §13). Posts a real Despesa (files_design/03 "Aba Despesa"), status Pago
 * (padrão da aba), classificação sugerida "Circulante" — a despesa do dia a
 * dia é o caso comum e a pessoa pode editar depois pelo Histórico.
 */
export function useCreateQuickExpense(month: Month) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      amount: Cents
      date: IsoDate
      categoryId: string
      bankAccountId: string
      classification?: Classification
    }) =>
      apiPost<Entry>('/entries', {
        kind: 'Expense',
        amount: body.amount,
        date: body.date,
        status: 'Paid',
        categoryId: body.categoryId,
        bankAccountId: body.bankAccountId,
        classification: body.classification ?? 'Current',
      }),
    onSuccess: () => {
      // Despesas por Categoria, o Detalhe da Categoria e Entradas e Saídas
      // (income-statement) todos derivam do mesmo mês de lançamentos.
      void queryClient.invalidateQueries({ queryKey: ['entries'] })
      void queryClient.invalidateQueries({ queryKey: ['income-statement', month] })
    },
  })
}

/**
 * "Redirecionar valor" — Onde Está Meu Dinheiro e Detalhe do Consumo Livre
 * (files_design/01 §13, §4a). Uma Transferência: ADR-0017 §2.
 *
 * Substituiu o par `useAdjustBankAccountBalance`/`useAdjustInvestmentValue`
 * encadeado pelo cliente. O motivo não é estilo: duas chamadas separadas não
 * são uma operação, e o comentário que estava aqui sancionava isso por escrito
 * ("duas chamadas PATCH, uma por lado, são a forma sancionada"). Com elas,
 * falhar a segunda depois de a primeira ter passado apagava dinheiro.
 *
 * Os dois hooks de `PATCH` continuam existindo para o que eles realmente são —
 * editar o cadastro de uma conta ou de um investimento —, e não para mover
 * valor entre eles.
 */
export function useTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: unknown) => apiPost('/transfers', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['balance-sheet'] })
      void queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      void queryClient.invalidateQueries({ queryKey: ['investments'] })
    },
  })
}

/**
 * Editar o SALDO de uma conta no cadastro — não mover dinheiro entre duas.
 *
 * `balance` é campo mantido pela pessoa (files_design/03, "Contas Bancárias"),
 * não derivado dos lançamentos, então corrigi-lo é um `PATCH` como qualquer
 * outro campo. Mover valor de uma posição para outra é `useTransfer`
 * (ADR-0017 §2): encadear dois destes era o que apagava dinheiro quando o
 * segundo falhava.
 */
export function useAdjustBankAccountBalance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, balance }: { id: string; balance: Cents }) =>
      apiPatch<BankAccount>(`/bank-accounts/${id}`, { balance }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['balance-sheet'] })
      void queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
  })
}

/** Mesmo raciocínio de `useAdjustBankAccountBalance`, para o lado Investimento. */
export function useAdjustInvestmentValue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, accumulatedValue }: { id: string; accumulatedValue: Cents }) =>
      apiPatch<Investment>(`/investments/${id}`, { accumulatedValue }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['balance-sheet'] })
      void queryClient.invalidateQueries({ queryKey: ['investments'] })
    },
  })
}

export type { PendingItem }

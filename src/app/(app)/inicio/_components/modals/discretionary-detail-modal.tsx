'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'
import { SearchCreateField, type SearchCreateItem } from '@/components/patterns/search-create-field'
import { formatMoney, formatMonthName, previousMonth, ZERO, type Cents } from '@/domain/core'
import {
  leftoverBroughtForward,
  leftoverOfMonth,
  pendingLeftover,
} from '@/domain/discretionary-spending'
import {
  useBankAccounts,
  useDiscretionaryExpenses,
  useLeftoverDirections,
  useInvestments,
  type DiscretionarySpendingConfig,
} from '../../_lib/queries'
import {
  useAdjustBankAccountBalance,
  useAdjustInvestmentValue,
  useEditDiscretionaryExpense,
} from '../../_lib/mutations'
import { DiscretionaryConfigureModal } from './discretionary-configure-modal'
import { DiscretionaryExpenseModal } from './discretionary-expense-modal'
import type { Month } from '@/domain/core'

/**
 * Detalhe do Consumo Livre — Estado C, modal sobre Início, docs/figma/frames/
 * 345-752__desktop-detalhe-do-consumo-livre-modal-sobre-inicio.xml, node
 * 192:15.
 *
 * The "sobra do mês anterior" IS a required row of "Histórico deste mês", and
 * four sources say so: node `192:22` of that frame draws it as the FIRST row
 * (y=144, before the gastos at y=193/249/305), with its own layout — h=33
 * against h=40 for a gasto, and no "Editar" button inside it — carrying the
 * literal texts `192:23` "+ Sobra de Junho, adicionada ao saldo" and `192:24`
 * "+ R$ 150,00"; PRD v7 spells it in the Consumo Livre definition, in UC32 and
 * in the critério de liberação ("mostra a sobra do mês anterior como linha
 * explícita"); files_design/01 §4a and files_design/02 add "não some
 * silenciosamente".
 *
 * P14 (docs/PERGUNTAS-EM-ABERTO.md) asks only whether that sobra is a stored
 * record or a derived value — a persistence question, not a UI one. Here it is
 * DERIVED, which answers the screen without deciding P14: see
 * `previousLeftover` below for the assumption that derivation carries.
 */
export function DiscretionaryDetailModal({
  open,
  onOpenChange,
  month,
  config,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: Month
  config: DiscretionarySpendingConfig | null | undefined
}) {
  const [editingConfig, setEditingConfig] = React.useState(false)
  const [addingExpense, setAddingExpense] = React.useState(false)

  return (
    <>
      <Dialog open={open && !editingConfig && !addingExpense} onOpenChange={onOpenChange}>
        {/* 420 de largura: frame 192:15 (Wireframe), o contêiner do modal em 345:752. */}
        <DialogContent width="detail" aria-describedby={undefined}>
          {config ? (
            <DiscretionaryDetailBody
              month={month}
              config={config}
              onEditConfig={() => setEditingConfig(true)}
              onAddExpense={() => setAddingExpense(true)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <DiscretionaryConfigureModal
        open={editingConfig}
        onOpenChange={setEditingConfig}
        current={config}
      />
      <DiscretionaryExpenseModal
        open={addingExpense}
        onOpenChange={setAddingExpense}
        month={month}
      />
    </>
  )
}

function DiscretionaryDetailBody({
  month,
  config,
  onEditConfig,
  onAddExpense,
}: {
  month: Month
  config: DiscretionarySpendingConfig
  onEditConfig: () => void
  onAddExpense: () => void
}) {
  const expenses = useDiscretionaryExpenses(month)
  const leftoverDirections = useLeftoverDirections()
  const previous = previousMonth(month)
  const previousExpenses = useDiscretionaryExpenses(previous)
  const bankAccounts = useBankAccounts()
  const investments = useInvestments()
  const editExpense = useEditDiscretionaryExpense(month)
  const adjustBankAccount = useAdjustBankAccountBalance()
  const adjustInvestment = useAdjustInvestmentValue()

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editAmount, setEditAmount] = React.useState<Cents>(ZERO)
  const [editLabel, setEditLabel] = React.useState('')

  const [redirectQuery, setRedirectQuery] = React.useState('')
  const [redirectTo, setRedirectTo] = React.useState<SearchCreateItem | null>(null)
  const [redirectValue, setRedirectValue] = React.useState<Cents>(ZERO)
  const [redirectError, setRedirectError] = React.useState<string | null>(null)

  const accountName =
    bankAccounts.data?.data.find((a) => a.id === config.sourceAccountId)?.label ?? 'conta'
  const spent = (expenses.data?.data ?? []).reduce((sum, e) => sum + e.amount, 0) as Cents

  /**
   * A sobra que o mês anterior entregou a este (node `192:22`), derivada em vez
   * de guardada — P14 segue aberta sobre persistir ou derivar.
   *
   * SUPOSIÇÃO NOMEADA: a verba do mês anterior é tomada como `monthlyAmount`
   * puro, sem a sobra que ELE tenha recebido do mês retrasado. Encadear sobra
   * sobre sobra, mês após mês, é uma decisão que nenhuma fonte toma, e derivá-la
   * assim custaria uma requisição por mês de histórico.
   */
  const previousSpent = (previousExpenses.data?.data ?? []).reduce(
    (sum, e) => sum + e.amount,
    0,
  ) as Cents
  // Verba = saldo da conta (2026-09-29): não há sobra — o que não foi gasto
  // continua na conta de origem.
  const balanceMode = config.allowanceKind === 'SourceBalance'
  const previousLeftover = balanceMode
    ? ZERO
    : leftoverOfMonth(config.monthlyAmount as Cents, previousSpent)
  const sourceBalance = (bankAccounts.data?.data.find((a) => a.id === config.sourceAccountId)
    ?.balance ?? 0) as Cents
  const limit = balanceMode ? ((spent + sourceBalance) as Cents) : (config.monthlyAmount as Cents)
  /**
   * P14 (produto, 2026-09-08) partiu esta linha em duas realidades: a sobra só
   * entra na verba se a pessoa direcionar. Antes disto a linha mostrava a sobra
   * INTEIRA e afirmava "adicionada ao saldo" — errada duas vezes, no valor e na
   * promessa.
   *
   * A decisão de design de 2026-09-09 foi manter a linha SEMPRE visível,
   * dizendo se entrou ou não: o histórico do mês conta a sobra mesmo quando ela
   * ainda é uma decisão pendente. Direcionamento parcial produz as duas linhas,
   * que é o que de fato aconteceu.
   */
  const direcionamentos = leftoverDirections.data?.data ?? []
  const trazido = leftoverBroughtForward(direcionamentos, previous)
  const aguardando = pendingLeftover(previousLeftover, direcionamentos, previous)
  const monthExpenses = expenses.data?.data ?? []

  const redirectItems: readonly (SearchCreateItem & { kind: 'BankAccount' | 'Investment' })[] =
    React.useMemo(() => {
      const accounts = (bankAccounts.data?.data ?? []).map((a) => ({
        id: a.id,
        label: a.label,
        kind: 'BankAccount' as const,
      }))
      const invs = (investments.data?.data ?? []).map((i) => ({
        id: i.id,
        label: i.name,
        kind: 'Investment' as const,
      }))
      const term = redirectQuery.trim().toLowerCase()
      const all = [...accounts, ...invs]
      return term === '' ? all : all.filter((item) => item.label.toLowerCase().includes(term))
    }, [bankAccounts.data, investments.data, redirectQuery])

  async function handleRedirect(event: React.FormEvent) {
    event.preventDefault()
    setRedirectError(null)
    if (!redirectTo || redirectValue <= 0) return
    const kind = redirectItems.find((item) => item.id === redirectTo.id)?.kind ?? 'BankAccount'
    try {
      if (kind === 'BankAccount') {
        const current =
          bankAccounts.data?.data.find((a) => a.id === redirectTo.id)?.balance ?? (0 as Cents)
        await adjustBankAccount.mutateAsync({
          id: redirectTo.id,
          balance: (current + redirectValue) as Cents,
        })
      } else {
        const current =
          investments.data?.data.find((i) => i.id === redirectTo.id)?.accumulatedValue ??
          (0 as Cents)
        await adjustInvestment.mutateAsync({
          id: redirectTo.id,
          accumulatedValue: (current + redirectValue) as Cents,
        })
      }
      setRedirectTo(null)
      setRedirectQuery('')
      setRedirectValue(ZERO)
    } catch {
      setRedirectError('Não foi possível redirecionar agora. Tente de novo.')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Consumo Livre</DialogTitle>
        {/*
          Node `192:20`: "R$ 350 de R$ 500 · saindo da Nubank" — o denominador é
          a verba configurada, o mesmo número que o card do Início imprime
          (`347:718`, "R$ 350 / R$ 500"). O frame NÃO soma a sobra de R$ 150,00
          ao teto exibido, e o card e o modal têm que dizer o mesmo número na
          mesma tela. `allowanceForMonth` (src/domain/discretionary-spending/
          rules.ts) modela a leitura oposta e hoje nenhuma tela a usa: qual das
          duas vale é a metade aritmética de P14 e depende da pessoa
          desenvolvedora — o que esta tela desenha é o que o frame desenha.
        */}
        <DialogDescription>
          {formatMoney(spent)} de {formatMoney(limit)} · saindo da {accountName}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <section className="flex flex-col gap-4">
          <h3 className="text-style-label-xs text-ink-secondary">Histórico deste mês</h3>
          {expenses.isPending || previousExpenses.isPending ? (
            <p className="text-style-body-sm text-ink-secondary">Carregando…</p>
          ) : monthExpenses.length > 0 || previousLeftover > ZERO ? (
            <ul className="flex flex-col">
              {previousLeftover > ZERO ? (
                /**
                 * Node `192:22`: primeira linha do histórico, antes de qualquer
                 * gasto, com os mesmos 9px de respiro vertical das linhas de
                 * gasto — ela mede 33 e não 40 justamente por não ter o botão
                 * "Editar" (199:2) dentro, e é isso, não um espaçamento
                 * próprio, que dá a diferença de 7px.
                 */
                <>
                  {trazido > 0 ? (
                    <li className="flex items-center justify-between gap-16 border-b border-line-default py-8 last:border-0">
                      <span className="text-style-body-md text-ink-primary">
                        + Sobra de {formatMonthName(previous)}, adicionada ao saldo
                      </span>
                      <span className="numeric text-style-body-md text-ink-primary">
                        + {formatMoney(trazido)}
                      </span>
                    </li>
                  ) : null}
                  {aguardando > 0 ? (
                    <li className="flex items-center justify-between gap-16 border-b border-line-default py-8 last:border-0">
                      <span className="text-style-body-md text-ink-secondary">
                        Sobra de {formatMonthName(previous)}, aguardando direcionamento
                      </span>
                      <span className="numeric text-style-body-md text-ink-secondary">
                        {formatMoney(aguardando)}
                      </span>
                    </li>
                  ) : null}
                </>
              ) : null}
              {monthExpenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex items-center justify-between gap-16 border-b border-line-default py-8 last:border-0"
                >
                  {editingId === expense.id ? (
                    /**
                     * O único estado de edição inline que o Figma desenha é o
                     * Wireframe `46:8` "Estado — Editar categoria (inline)", e
                     * ele desenha duas coisas que este formulário não fazia:
                     * (1) o campo editável ocupa a LARGURA DA LINHA — nó
                     * `46:26`, 296 dentro de uma linha de 320 — em vez de
                     * dividir a linha com o botão; (2) "Cancelar" e "Salvar"
                     * descem para uma linha própria abaixo (`46:28`, y=92,
                     * "Cancelar" `46:29` antes de "Salvar" `46:31`), e a nota
                     * literal `46:33` diz "\"Salvar\" confirma, \"Cancelar\"
                     * reverte sem alterar" — o "Cancelar" não existia aqui.
                     *
                     * O layout antigo punha data + campo de 120px + "Salvar"
                     * na mesma linha, alegando "the fixed 44px row height":
                     * a linha do histórico mede 60 no Mockup (`1005:3312`) e
                     * os 44 são a altura do botão "Editar" (`1005:3316`,
                     * 71×44); o espaço à direita da data é 155 (`1005:3314`),
                     * que não comporta campo de 120 mais um "Salvar".
                     */
                    <form
                      className="flex flex-1 flex-col gap-8"
                      onSubmit={(event) => {
                        event.preventDefault()
                        editExpense.mutate(
                          {
                            id: expense.id,
                            amount: editAmount,
                            // Campo vazio é "sem Rótulo", e o contrato guarda
                            // ausência como `null`, nunca como string vazia
                            // (labelSchema, src/api/contracts/common.ts).
                            label: editLabel.trim() === '' ? null : editLabel.trim(),
                          },
                          { onSuccess: () => setEditingId(null) },
                        )
                      }}
                    >
                      <div className="flex items-center gap-8">
                        <span className="text-style-body-md text-ink-primary">
                          Dia {expense.date.slice(8, 10)}/{expense.date.slice(5, 7)}
                        </span>
                        <MoneyInput
                          value={editAmount}
                          onValueChange={setEditAmount}
                          aria-label={`Valor do gasto de ${expense.date}`}
                          className="flex-1"
                        />
                      </div>
                      {/*
                        O segundo campo editável, e o único fluxo fora da aba IR
                        que tem Rótulo: Figma Wireframe, nota `164:5`, texto
                        `164:7` — "Rótulo existe só nas abas que não têm campo
                        de Categoria (Consumo Livre e IR), porque sem Categoria,
                        não tem outro jeito de diferenciar lançamentos parecidos
                        no Histórico" — e files_design/03 §"Consumo Livre —
                        widget": "Campos editáveis: Valor, e opcionalmente
                        Rótulo". Enquanto o formulário tinha só o Valor, o
                        Rótulo não era alcançável em NENHUMA tela do app: a
                        coluna `discretionary_expenses.label` existia no banco e
                        nunca recebia nada.

                        "Rótulo (opcional)" é o texto que o Figma desenha para
                        este campo, palavra por palavra, no único lugar em que
                        ele aparece desenhado — nó `68:4` do frame `262:226`
                        (aba IR), repetido em `305:1035`. Sem placeholder: o de
                        `68:6` ("Ex: IR referente a 2025") é texto de IR, e
                        nenhum frame desenha um para o Consumo Livre.
                      */}
                      <Field label="Rótulo (opcional)" required={false}>
                        {({ id, 'aria-describedby': describedBy }) => (
                          <Input
                            id={id}
                            aria-describedby={describedBy}
                            value={editLabel}
                            onChange={(event) => setEditLabel(event.target.value)}
                          />
                        )}
                      </Field>
                      <div className="flex items-center gap-8">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={editExpense.isPending}
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" size="default" disabled={editExpense.isPending}>
                          Salvar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {/*
                        O Rótulo aparece ao lado da data porque é para isso que
                        ele existe: `164:7` diz, literalmente, que sem Categoria
                        "não tem outro jeito de diferenciar lançamentos
                        parecidos no Histórico" — um campo que só se escreve não
                        diferencia nada. O separador " · " é o do próprio card,
                        nó `192:20` ("R$ 350 de R$ 500 · saindo da Nubank").

                        SUPOSIÇÃO NOMEADA: o frame `345:752` desenha as três
                        linhas de gasto sem Rótulo (`192:26`/`192:29`/`192:32`
                        trazem só "Dia 05/07", "Dia 12/07", "Dia 18/07"), então
                        ele não mostra ONDE o Rótulo entra na linha — mas
                        também não desenha nenhum gasto rotulado. Aqui ele entra
                        depois da data, dentro dos 210 de largura que `192:26`
                        reserva ao texto numa linha de 364.
                      */}
                      <span className="text-style-body-md text-ink-primary">
                        Dia {expense.date.slice(8, 10)}/{expense.date.slice(5, 7)}
                        {expense.label === null ? null : ` · ${expense.label}`}
                      </span>
                      <span className="numeric text-style-body-md text-ink-primary">
                        − {formatMoney(expense.amount as Cents)}
                      </span>
                      <Button
                        variant="secondary"
                        size="compact"
                        onClick={() => {
                          setEditingId(expense.id)
                          setEditAmount(expense.amount as Cents)
                          setEditLabel(expense.label ?? '')
                        }}
                      >
                        Editar
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-style-body-sm text-ink-secondary">Nenhum gasto este mês ainda.</p>
          )}
        </section>

        <form className="flex flex-col gap-16" onSubmit={handleRedirect}>
          <h3 className="text-style-label-xs text-ink-secondary">Redirecionar saldo restante</h3>
          <div className="flex flex-col gap-16">
            <Field label="Para onde">
              {({ id, ...aria }) => (
                <SearchCreateField
                  id={id}
                  {...aria}
                  items={redirectItems}
                  query={redirectTo?.label ?? redirectQuery}
                  onQueryChange={(next) => {
                    setRedirectQuery(next)
                    setRedirectTo(null)
                  }}
                  onSelect={(item) => {
                    setRedirectTo(item)
                    setRedirectQuery(item.label)
                  }}
                  placeholder="Buscar conta, investimento ou dívida…"
                />
              )}
            </Field>
            {/* 180: o mínimo para "R$ 999.000.000.000,00" (148 de texto + 12 + 12
                de respiro) com 8 de folga. Ver `--width-field-money-dialog`. */}
            <Field label="Valor" className="w-[var(--width-field-money-dialog)]">
              {({ id, ...aria }) => (
                <MoneyInput
                  id={id}
                  value={redirectValue}
                  onValueChange={setRedirectValue}
                  {...aria}
                />
              )}
            </Field>
          </div>
          {redirectError ? (
            <p role="alert" className="text-style-body-sm text-ink-negative">
              {redirectError}
            </p>
          ) : null}
          <Button type="submit" width="full" disabled={!redirectTo || redirectValue <= 0}>
            Redirecionar
          </Button>
        </form>

        <RequiredFieldLegend />
        <div className="flex gap-8">
          <Button width="full" onClick={onEditConfig}>
            Editar valor e conta
          </Button>
          <Button width="full" onClick={onAddExpense}>
            Gastei um valor
          </Button>
        </div>
      </DialogBody>
    </>
  )
}

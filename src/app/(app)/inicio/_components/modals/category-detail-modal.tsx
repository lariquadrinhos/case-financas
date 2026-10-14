'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatMoney, ZERO, type Cents, type IsoDate, type Month } from '@/domain/core'
import { currentIsoDate } from '@/lib/format'
import {
  useBankAccounts,
  useEntriesByCategory,
  type Category,
  type Entry,
} from '../../_lib/queries'
import { useCreateQuickExpense } from '../../_lib/mutations'
import { ModalBackLink } from './modal-back-link'

/**
 * Detalhe da Categoria — modal sobre Início, docs/figma/frames/
 * 345-2__desktop-detalhe-da-categoria-modal-sobre-inicio.xml, node 183:2.
 *
 * Opened by clicking a block in "Despesas por Categoria" — EXCEPT the system
 * category Consumo Livre, which opens its own painel instead
 * (files_design/01 §4, "Despesas por Categoria").
 */
export function CategoryDetailModal({
  category,
  month,
  open,
  onOpenChange,
}: {
  category: Category | null
  month: Month
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 480 de largura: frame 183:2 (Wireframe), o contêiner do modal em 345:2. */}
      <DialogContent width="narrow">
        {category ? <CategoryDetailBody category={category} month={month} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CategoryDetailBody({ category, month }: { category: Category; month: Month }) {
  const entries = useEntriesByCategory(month, category.id)
  const bankAccounts = useBankAccounts()
  const createExpense = useCreateQuickExpense(month)

  const [amount, setAmount] = React.useState<Cents>(ZERO)
  const [date, setDate] = React.useState(() => currentIsoDate())
  const [bankAccountId, setBankAccountId] = React.useState('')

  // "Conta pré-selecionada com a mais usada nessa categoria" — the account of
  // the most recent lançamento already in this category, editable.
  const mostUsedAccountId = React.useMemo(() => {
    const list = entries.data?.data ?? []
    const withAccount = list.find(
      (entry): entry is Entry & { bankAccountId: string } => 'bankAccountId' in entry,
    )
    return withAccount?.bankAccountId ?? ''
  }, [entries.data])

  React.useEffect(() => {
    if (!bankAccountId && mostUsedAccountId) setBankAccountId(mostUsedAccountId)
  }, [bankAccountId, mostUsedAccountId])

  const accounts = bankAccounts.data?.data ?? []
  const canSubmit = amount > 0 && date !== '' && bankAccountId !== ''

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    createExpense.mutate(
      {
        amount,
        date: date as IsoDate,
        categoryId: category.id,
        bankAccountId,
      },
      {
        onSuccess: () => setAmount(ZERO),
      },
    )
  }

  return (
    <>
      <DialogHeader className="gap-16">
        {/* Mesmo caso do Detalhe do Bloco: o diálogo abre direto no link de
            volta, sem nó de título — medido no Wireframe 183:2 (primeiro
            filho é `183:3` "← Despesas por Categoria" em x=28 y=28) e no
            Mockup 1002:2841 (primeiro filho é `1022:3017` "Link"). Sem
            <DialogTitle> o leitor de tela anuncia só "diálogo", então o nome
            existe invisível, pra não inventar pixel que o frame não desenha.
            O texto é o nome que o Figma dá ao frame — "Detalhe da Categoria"
            (345:2 no Wireframe, 1002:2607 no Mockup) — e só ele: a categoria
            clicada é anunciada pela DialogDescription logo abaixo. */}
        <DialogTitle className="sr-only">Detalhe da Categoria</DialogTitle>
        <ModalBackLink label="Despesas por Categoria" />
        <div className="h-[var(--stroke-hairline)] bg-line-default" />
      </DialogHeader>
      <DialogBody>
        <DialogDescription className="sr-only">
          Lançamentos do mês na categoria {category.name} e formulário rápido de novo gasto.
        </DialogDescription>

        <section className="flex flex-col gap-4">
          <h3 className="text-style-label-xs text-ink-secondary">Lançamentos deste mês</h3>
          {entries.isPending ? (
            <p className="text-style-body-sm text-ink-secondary">Carregando…</p>
          ) : entries.data && entries.data.data.length > 0 ? (
            <ul className="flex flex-col">
              {entries.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-16 border-b border-line-default py-12 last:border-0"
                >
                  <div className="flex flex-col gap-4">
                    <span className="text-style-body-md text-ink-primary">
                      {'label' in entry && entry.label ? entry.label : category.name}
                    </span>
                    <span className="flex items-center gap-4 text-style-body-sm text-ink-secondary">
                      {'entity' in entry ? (
                        <Badge tone={entry.entity === 'PF' ? 'pf' : 'pj'}>{entry.entity}</Badge>
                      ) : null}
                      {entry.status === 'Paid' ? 'Pago' : 'Previsto'}
                    </span>
                  </div>
                  <span className="numeric text-style-body-md text-ink-primary">
                    {formatMoney(entry.amount as Cents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-style-body-sm text-ink-secondary">
              Nenhum lançamento nesta categoria este mês.
            </p>
          )}
        </section>

        <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
          <h3 className="text-style-label-xs text-ink-secondary">
            + Adicionar gasto em {category.name}
          </h3>
          {/* "Valor" ocupa a linha inteira e "Data"/"Conta" descem — empilhado
              desde 2026-09-11. Em três colunas, o diálogo de 480 dava 128 de
              largura a cada campo, e "R$ 999.000.000.000,00" precisa de 180
              (154 de texto medido no navegador + 12 + 12 de respiro + borda).
              Dar 180 a um espremia os
              outros dois a 106. Medição em `--width-field-money-dialog`. */}
          <div className="flex flex-col gap-12">
            <Field label="Valor">
              {({ id, ...aria }) => (
                <MoneyInput id={id} value={amount} onValueChange={setAmount} {...aria} />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-12">
            <Field label="Data">
              {({ id, ...aria }) => (
                <Input
                  id={id}
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  {...aria}
                />
              )}
            </Field>
            <Field label="Conta">
              {({ id, ...aria }) => (
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger id={id} {...aria} />
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          <Button type="submit" width="full" disabled={!canSubmit || createExpense.isPending}>
            Confirmar
          </Button>
        </form>

        <RequiredFieldLegend />
        <p className="text-style-body-sm text-ink-secondary">
          Categoria já vem escolhida. Conta pré-selecionada com a mais usada nessa categoria,
          editável.
        </p>
      </DialogBody>
      <DialogFooter />
    </>
  )
}

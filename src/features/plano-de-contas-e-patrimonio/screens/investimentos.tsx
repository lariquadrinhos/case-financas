'use client'

import * as React from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { ConfirmActionButton } from '@/components/patterns/confirm-action-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { ErrorState } from '@/components/patterns/error-state'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { cents, formatMoney, type Cents } from '@/domain/core'
import { investments } from '../investments'
import { OpenFinanceLinksCard } from '@/features/open-finance/open-finance-links-card'
import { InvestmentForm } from '../investment-form'
import type { Investment } from '../types'

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

interface FormState {
  name: string
  entity: 'PF' | 'PJ'
  accumulatedValue: Cents
}

export function InvestimentosScreen() {
  const list = investments.useList()

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Investimentos</h1>
        {/* Figma 333:39, word for word. */}
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Investimentos: o valor acumulado que você já tem aplicado, sem detalhar a carteira.
          Atualize aqui quando quiser, sem precisar reavaliar todo mês.
        </p>
      </div>
      <AddInvestmentCard />
      <Card>
        <CardHeader>
          <CardTitle>Investimentos cadastrados</CardTitle>
        </CardHeader>
        <CardBody>
          {list.isLoading ? (
            <Loading label="Carregando investimentos" bars={SKELETON_BARS.INVESTIMENTOS} />
          ) : list.isError ? (
            <ErrorState
              message="Não foi possível carregar seus investimentos. Verifique sua conexão e tente de novo."
              onRetry={() => void list.refetch()}
            />
          ) : list.data && list.data.data.length > 0 ? (
            <InvestmentTable items={list.data.data} />
          ) : (
            <Empty copy={EMPTY_STATES.INVESTIMENTOS} />
          )}
        </CardBody>
      </Card>
      {/* ADR-0020 §3 — não está no Figma; ver o cabeçalho do componente. */}
      <OpenFinanceLinksCard
        kinds={['Investment']}
        options={(list.data?.data ?? []).map((item) => ({ id: item.id, label: item.name }))}
      />
    </div>
  )
}

function AddInvestmentCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar investimento</CardTitle>
      </CardHeader>
      <CardBody>
        <InvestmentForm />
      </CardBody>
    </Card>
  )
}

function InvestmentTable({ items }: { items: readonly Investment[] }) {
  const [editingId, setEditingId] = React.useState<string | null>(null)

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Nome</TableHeader>
          <TableHeader>Entidade</TableHeader>
          <TableHeader numeric>Valor acumulado</TableHeader>
          <TableHeader aria-label="Ações" />
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) =>
          editingId === item.id ? (
            <EditInvestmentRow key={item.id} item={item} onDone={() => setEditingId(null)} />
          ) : (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.entity}</TableCell>
              <TableCell numeric>{formatMoney(cents(item.accumulatedValue))}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-4">
                  <Button variant="secondary" size="compact" onClick={() => setEditingId(item.id)}>
                    Editar
                  </Button>
                  <DiscardInvestmentButton id={item.id} name={item.name} />
                </div>
              </TableCell>
            </TableRow>
          ),
        )}
      </TableBody>
    </Table>
  )
}

function DiscardInvestmentButton({ id, name }: { id: string; name: string }) {
  const remove = investments.useRemove()
  /* P38 (design, 2026-09-09): a linha de consequência do `34:36`. O Figma só a
     desenha para o "Descartar" da Revisão de Recorrentes, onde ela diz algo
     tranquilizador ("a série continua normalmente"); aqui a consequência é o
     oposto, e foi medida: este "Descartar" APAGA o cadastro, e o RESTRICT do
     banco recusa com 409 quando algo ainda aponta para ele. São as duas coisas
     que a pessoa não pode adivinhar. */
  return (
    <ConfirmActionButton
      label="Descartar"
      // A única FK para `investments` em schema.ts vem de `allocation_items` —
      // um Direcionamento (Destinar o Lucro, venda de bem, Pendência). Nenhum
      // lançamento aponta para um investimento, ao contrário do que a frase
      // antiga dizia.
      consequence="Isso apaga o investimento. Não funciona enquanto algum direcionamento ainda apontar para ele."
      blockedMessage="Não dá pra descartar: ainda há direcionamento apontando para este investimento."
      itemName={name}
      pending={remove.isPending}
      onConfirm={() => remove.mutateAsync(id)}
    />
  )
}

function EditInvestmentRow({ item, onDone }: { item: Investment; onDone: () => void }) {
  const patch = investments.usePatch()
  const [form, setForm] = React.useState<FormState>({
    name: item.name,
    entity: item.entity,
    accumulatedValue: cents(item.accumulatedValue),
  })

  function handleSave() {
    const name = form.name.trim()
    if (name === '') return
    patch.mutate(
      {
        id: item.id,
        body: {
          name,
          entity: form.entity,
          // Só quando mudou: num investimento vinculado o valor vem do banco
          // (ADR-0020 §3) — ver o mesmo caso em contas-bancarias.tsx.
          ...(form.accumulatedValue !== item.accumulatedValue
            ? { accumulatedValue: form.accumulatedValue }
            : {}),
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <TableRow className="h-auto align-top">
      <TableCell colSpan={4}>
        {/* Wireframe `46:8` "Estado — Editar categoria (inline)"
            (docs/figma/frames/46-8__estado-editar-categoria-inline.xml) é o
            ÚNICO estado de edição inline que o arquivo desenha, e fixa duas
            coisas: o campo editável ocupa a LINHA INTEIRA (`46:26`, 296 de
            320, x=12) e "Cancelar"/"Salvar" (`46:29` e `46:31`, NESTA ordem)
            ficam numa linha PRÓPRIA abaixo dele (`46:28`, y=92 — 12 abaixo
            do campo, que termina em y=80). O que estava aqui era o oposto:
            campo de largura fixa em 200 (`--width-inline-name-edit`) e os botões ao
            lado, Salvar antes de Cancelar, justificados por "sem apertar
            Salvar/Cancelar" — premissa que `46:8` desmente.

            `46:8` desenha só o caso de campo único; a distribuição dos demais
            campos segue o "Adicionar investimento" da mesma tela, Mockup
            `930:1388`: Nome 458,5 · Entidade 91 · Valor 458,5,
            em 1040 (458,5 + 16 + 91 + 16 + 458,5). As colunas de Nome e de valor são as
            ELÁSTICAS que fecham a linha — daí `flex-1`, e nenhuma largura em
            px. */}
        <div className="flex flex-col gap-12 py-8">
          <div className="flex items-end gap-16">
            <Field label="Nome" className="min-w-0 flex-1">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Entidade" required={false} className="shrink-0">
              {(fieldProps) => (
                <SegmentedControl
                  {...fieldProps}
                  aria-label="Entidade"
                  options={ENTITY_OPTIONS}
                  value={form.entity}
                  onValueChange={(entity) => setForm((prev) => ({ ...prev, entity }))}
                />
              )}
            </Field>
            <Field label="Valor acumulado" className="min-w-0 flex-1">
              {(fieldProps) => (
                <MoneyInput
                  {...fieldProps}
                  value={form.accumulatedValue}
                  onValueChange={(accumulatedValue) =>
                    setForm((prev) => ({ ...prev, accumulatedValue }))
                  }
                />
              )}
            </Field>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="secondary" disabled={patch.isPending} onClick={onDone}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={patch.isPending} onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

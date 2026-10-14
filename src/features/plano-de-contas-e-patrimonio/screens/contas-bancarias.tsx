'use client'

import * as React from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { ColourSwatchPicker } from '@/components/patterns/colour-swatch-picker'
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
import { ZERO, cents, formatMoney, type Cents } from '@/domain/core'
import type { BankAccountColour } from '@/domain/assets'
import { ApiError } from '@/lib/api-client'
import {
  BANK_SUGGESTION_SWATCHES,
  DEFAULT_BANK_ACCOUNT_COLOUR,
  bankAccountSwatch,
  suggestedColourFor,
} from '@/lib/bank-account-colours'
import { bankAccounts } from '../bank-accounts'
import { OpenFinanceLinksCard } from '@/features/open-finance/open-finance-links-card'
import type { BankAccount } from '../types'

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

interface FormState {
  label: string
  colour: BankAccountColour
  entity: 'PF' | 'PJ'
  balance: Cents
}

const EMPTY_FORM: FormState = {
  label: '',
  colour: DEFAULT_BANK_ACCOUNT_COLOUR,
  entity: 'PF',
  balance: ZERO,
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível salvar. Tente novamente.'
}

export function ContasBancariasScreen() {
  const list = bankAccounts.useList()

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Contas Bancárias</h1>
        {/* Figma 332:39, word for word. */}
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Contas Bancárias: onde o dinheiro realmente está guardado. Cadastre suas contas, com cor e
          entidade, pra saber de onde cada lançamento sai ou entra.
        </p>
      </div>
      <AddBankAccountCard />
      <Card>
        <CardHeader>
          <CardTitle>Contas cadastradas</CardTitle>
        </CardHeader>
        <CardBody>
          {list.isLoading ? (
            <Loading label="Carregando contas bancárias" bars={SKELETON_BARS.CONTAS_BANCARIAS} />
          ) : list.isError ? (
            <ErrorState
              message="Não foi possível carregar suas contas. Verifique sua conexão e tente de novo."
              onRetry={() => void list.refetch()}
            />
          ) : list.data && list.data.data.length > 0 ? (
            <BankAccountTable items={list.data.data} />
          ) : (
            <Empty copy={EMPTY_STATES.CONTAS_BANCARIAS} />
          )}
        </CardBody>
      </Card>
      {/* ADR-0020 §3 — não está no Figma; ver o cabeçalho do componente. */}
      <OpenFinanceLinksCard
        kinds={['Checking', 'CreditCard']}
        options={(list.data?.data ?? []).map((item) => ({ id: item.id, label: item.label }))}
      />
    </div>
  )
}

function AddBankAccountCard() {
  const create = bankAccounts.useCreate()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [labelError, setLabelError] = React.useState<string | undefined>(undefined)
  // Enquanto a pessoa não escolhe a cor, o nome decide: "Itaú" vira Laranja,
  // pela mesma regra do "Criar e vincular" do Open Finance (2026-09-29).
  const [colourTouched, setColourTouched] = React.useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const label = form.label.trim()
    if (label === '') {
      setLabelError('Informe o nome da conta.')
      return
    }
    setLabelError(undefined)
    create.mutate(
      { label, colour: form.colour, entity: form.entity, balance: form.balance },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM)
          setColourTouched(false)
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar conta</CardTitle>
      </CardHeader>
      <CardBody>
        <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
          {/* Figma 332:110: Nome da conta, Cor, Entidade e Saldo são uma
              única linha (x=0/321/565/721) — quebrada aqui em 2 grids por
              largura, mas preservando essa ordem de leitura/tab. */}
          <div className="grid grid-cols-2 gap-16">
            <Field label="Nome da conta" error={labelError}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={form.label}
                  onChange={(event) => {
                    const label = event.target.value
                    setForm((prev) => ({
                      ...prev,
                      label,
                      ...(colourTouched ? {} : { colour: suggestedColourFor(label) }),
                    }))
                  }}
                  placeholder="Ex: Nubank"
                />
              )}
            </Field>
            <Field label="Cor" required={false}>
              {(fieldProps) => (
                <ColourSwatchPicker
                  {...fieldProps}
                  aria-label="Cor"
                  swatches={BANK_SUGGESTION_SWATCHES}
                  value={form.colour}
                  onValueChange={(colour) => {
                    setColourTouched(true)
                    setForm((prev) => ({ ...prev, colour }))
                  }}
                />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <Field label="Entidade" required={false} className="w-fit">
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
            <Field label="Saldo">
              {(fieldProps) => (
                <MoneyInput
                  {...fieldProps}
                  value={form.balance}
                  onValueChange={(balance) => setForm((prev) => ({ ...prev, balance }))}
                />
              )}
            </Field>
          </div>
          {create.isError ? (
            <p role="alert" className="text-style-body-sm text-ink-negative">
              {errorMessage(create.error)}
            </p>
          ) : null}
          <div className="flex items-center justify-between">
            <RequiredFieldLegend />
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending ? 'Salvando…' : '+ Adicionar'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function BankAccountTable({ items }: { items: readonly BankAccount[] }) {
  const [editingId, setEditingId] = React.useState<string | null>(null)

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>Nome da conta</TableHeader>
          <TableHeader>Cor</TableHeader>
          <TableHeader>Entidade</TableHeader>
          <TableHeader numeric>Saldo</TableHeader>
          <TableHeader aria-label="Ações" />
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) =>
          editingId === item.id ? (
            <EditBankAccountRow key={item.id} item={item} onDone={() => setEditingId(null)} />
          ) : (
            <TableRow key={item.id}>
              <TableCell>{item.label}</TableCell>
              <TableCell>
                <span
                  aria-hidden="true"
                  className="inline-block h-[var(--space-16)] w-[var(--space-16)] rounded-pill align-middle"
                  style={{ backgroundColor: `var(${bankAccountSwatch(item.colour).cssVariable})` }}
                />
                <span className="ml-8 text-style-body-sm text-ink-secondary">
                  {bankAccountSwatch(item.colour).label}
                </span>
              </TableCell>
              <TableCell>{item.entity}</TableCell>
              <TableCell numeric>{formatMoney(cents(item.balance))}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-4">
                  <Button variant="secondary" size="compact" onClick={() => setEditingId(item.id)}>
                    Editar
                  </Button>
                  <DiscardBankAccountButton id={item.id} name={item.label} />
                </div>
              </TableCell>
            </TableRow>
          ),
        )}
      </TableBody>
    </Table>
  )
}

function DiscardBankAccountButton({ id, name }: { id: string; name: string }) {
  const remove = bankAccounts.useRemove()
  /* P38 (design, 2026-09-09): a linha de consequência do `34:36`. O Figma só a
     desenha para o "Descartar" da Revisão de Recorrentes, onde ela diz algo
     tranquilizador ("a série continua normalmente"); aqui a consequência é o
     oposto, e foi medida: este "Descartar" APAGA o cadastro, e o RESTRICT do
     banco recusa com 409 quando algo ainda aponta para ele. São as duas coisas
     que a pessoa não pode adivinhar. */
  return (
    <ConfirmActionButton
      label="Descartar"
      // A lista não é retórica: são as quatro FKs RESTRICT que apontam para
      // `bank_accounts` em schema.ts — `entries`, `recurrences`,
      // `discretionary_spending_config` e `allocation_items`. A frase antiga
      // citava só "lançamento", e `bank-accounts.repository.test.ts:88` derruba
      // o descarte usando SÓ o Consumo Livre: a pessoa iria procurar um
      // lançamento que não existe.
      consequence="Isso apaga a conta. Não funciona enquanto algum lançamento, recorrência, direcionamento ou o Consumo Livre ainda apontar para ela."
      blockedMessage="Não dá pra descartar: ainda há lançamento, recorrência, direcionamento ou o Consumo Livre apontando para esta conta."
      itemName={name}
      pending={remove.isPending}
      onConfirm={() => remove.mutateAsync(id)}
    />
  )
}

function EditBankAccountRow({ item, onDone }: { item: BankAccount; onDone: () => void }) {
  const patch = bankAccounts.usePatch()
  const [form, setForm] = React.useState<FormState>({
    label: item.label,
    colour: item.colour,
    entity: item.entity,
    balance: cents(item.balance),
  })

  function handleSave() {
    const label = form.label.trim()
    if (label === '') return
    patch.mutate(
      {
        id: item.id,
        body: {
          label,
          colour: form.colour,
          entity: form.entity,
          // Só quando mudou: numa conta vinculada ao Open Finance o saldo vem
          // do banco e o servidor recusa editá-lo (ADR-0020 §3) — reenviar o
          // valor que a lista trouxe recusaria até uma troca de nome, se a
          // sincronização tiver atualizado o saldo depois que a lista carregou.
          ...(form.balance !== item.balance ? { balance: form.balance } : {}),
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <TableRow className="h-auto py-8 align-top">
      <TableCell colSpan={5}>
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
            campos segue o "Adicionar conta" da mesma tela, Mockup
            `921:35`: Nome 336,5 · Cor 228 · Entidade 91 · Saldo 336,5,
            em 1040 (336,5 + 16 + 228 + 16 + 91 + 16 + 336,5). As colunas de Nome e de valor são as
            ELÁSTICAS que fecham a linha — daí `flex-1`, e nenhuma largura em
            px. */}
        <div className="flex flex-col gap-12 py-8">
          <div className="flex items-end gap-16">
            <Field label="Nome da conta" className="min-w-0 flex-1">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Cor" required={false} className="shrink-0">
              {(fieldProps) => (
                <ColourSwatchPicker
                  {...fieldProps}
                  aria-label="Cor"
                  swatches={BANK_SUGGESTION_SWATCHES}
                  value={form.colour}
                  onValueChange={(colour) => setForm((prev) => ({ ...prev, colour }))}
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
            <Field label="Saldo" className="min-w-0 flex-1">
              {(fieldProps) => (
                <MoneyInput
                  {...fieldProps}
                  value={form.balance}
                  onValueChange={(balance) => setForm((prev) => ({ ...prev, balance }))}
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

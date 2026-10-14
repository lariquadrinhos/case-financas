'use client'

import * as React from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
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
import { ZERO, cents, formatMoney, type Cents } from '@/domain/core'
import { ApiError } from '@/lib/api-client'
import { tangibleAssets } from '../tangible-assets'
import { VenderBemMaterialDialog } from './vender-bem-material-dialog'
import type { TangibleAsset } from '../types'

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

interface FormState {
  name: string
  entity: 'PF' | 'PJ'
  recordedValue: Cents
}

const EMPTY_FORM: FormState = { name: '', entity: 'PF', recordedValue: ZERO }

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível salvar. Tente novamente.'
}

export function BensMateriaisScreen() {
  const list = tangibleAssets.useList()

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Bens Materiais</h1>
        {/* Figma 298:2, word for word. */}
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Bens Materiais: imóveis, veículos e outros bens de valor. Não são reavaliados mês a mês,
          só na venda.
        </p>
      </div>
      <AddTangibleAssetCard />
      <Card>
        <CardHeader>
          <CardTitle>Bens cadastrados</CardTitle>
        </CardHeader>
        <CardBody>
          {list.isLoading ? (
            <Loading label="Carregando bens materiais" bars={SKELETON_BARS.BENS_MATERIAIS} />
          ) : list.isError ? (
            <ErrorState
              message="Não foi possível carregar seus bens materiais. Verifique sua conexão e tente de novo."
              onRetry={() => void list.refetch()}
            />
          ) : list.data && list.data.data.length > 0 ? (
            <TangibleAssetTable items={list.data.data} />
          ) : (
            <Empty copy={EMPTY_STATES.BENS_MATERIAIS} />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function AddTangibleAssetCard() {
  const create = tangibleAssets.useCreate()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [nameError, setNameError] = React.useState<string | undefined>(undefined)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    if (name === '') {
      setNameError('Informe o nome do bem.')
      return
    }
    setNameError(undefined)
    create.mutate(
      { name, entity: form.entity, recordedValue: form.recordedValue },
      { onSuccess: () => setForm(EMPTY_FORM) },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar bem material</CardTitle>
      </CardHeader>
      <CardBody>
        <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
          {/* Figma 96:139: Nome, Entidade e Valor inicial são uma única
              linha (x=0/347/694), nessa ordem. */}
          <div className="grid grid-cols-3 gap-16">
            <Field label="Nome" error={nameError}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Apartamento Centro"
                />
              )}
            </Field>
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
            <Field label="Valor inicial">
              {(fieldProps) => (
                <MoneyInput
                  {...fieldProps}
                  value={form.recordedValue}
                  onValueChange={(recordedValue) => setForm((prev) => ({ ...prev, recordedValue }))}
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

function TangibleAssetTable({ items }: { items: readonly TangibleAsset[] }) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [sellingAsset, setSellingAsset] = React.useState<TangibleAsset | null>(null)

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Nome</TableHeader>
            <TableHeader>Entidade</TableHeader>
            <TableHeader numeric>Valor registrado</TableHeader>
            <TableHeader aria-label="Ações" />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) =>
            editingId === item.id ? (
              <EditTangibleAssetRow key={item.id} item={item} onDone={() => setEditingId(null)} />
            ) : (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.entity}</TableCell>
                <TableCell numeric>{formatMoney(cents(item.recordedValue))}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-4">
                    <Button
                      variant="secondary"
                      size="compact"
                      onClick={() => setSellingAsset(item)}
                    >
                      Vender
                    </Button>
                    <Button
                      variant="secondary"
                      size="compact"
                      onClick={() => setEditingId(item.id)}
                    >
                      Editar
                    </Button>
                    <DiscardTangibleAssetButton id={item.id} name={item.name} />
                  </div>
                </TableCell>
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
      {sellingAsset ? (
        <VenderBemMaterialDialog
          asset={sellingAsset}
          open={sellingAsset !== null}
          onOpenChange={(open) => {
            if (!open) setSellingAsset(null)
          }}
        />
      ) : null}
    </>
  )
}

function DiscardTangibleAssetButton({ id, name }: { id: string; name: string }) {
  const remove = tangibleAssets.useRemove()
  /* P38 (design, 2026-09-09): a linha de consequência do `34:36`. O Figma só a
     desenha para o "Descartar" da Revisão de Recorrentes, onde ela diz algo
     tranquilizador ("a série continua normalmente"); aqui a consequência é o
     oposto, e foi medida: este "Descartar" APAGA o cadastro, e o RESTRICT do
     banco recusa com 409 quando algo ainda aponta para ele. São as duas coisas
     que a pessoa não pode adivinhar. */
  return (
    <ConfirmActionButton
      label="Descartar"
      // Este descarte NÃO fala de bloqueio, e a razão foi medida: ele não pode
      // ser recusado. A única FK para `tangible_assets` em schema.ts vem de
      // `pending_allocations`; uma Pendência só nasce na rota de venda, que
      // grava `soldOn` antes (e `evaluateAssetSale` recusa vender de novo);
      // esta lista lê `listUnsold` (`GET /api/v1/tangible-assets`, provado em
      // route.test.ts "lists only unsold assets"), então bem vendido nunca
      // chega aqui e nunca mostra este botão. Não há "des-vender": o `PATCH`
      // espalha `...existing` e preserva `soldOn`.
      //
      // A frase diz o que o descarte TIRA, como a do Passivo: `balance-sheet.ts`
      // inclui todo bem com `soldOn === null` sem filtro de mês, então apagar o
      // cadastro o remove do Balanço de todos os meses, passados inclusive.
      consequence="Isso apaga o bem. Ele sai do Balanço de todos os meses, inclusive os passados."
      itemName={name}
      pending={remove.isPending}
      onConfirm={() => remove.mutateAsync(id)}
    />
  )
}

function EditTangibleAssetRow({ item, onDone }: { item: TangibleAsset; onDone: () => void }) {
  const patch = tangibleAssets.usePatch()
  const [form, setForm] = React.useState<FormState>({
    name: item.name,
    entity: item.entity,
    recordedValue: cents(item.recordedValue),
  })

  function handleSave() {
    const name = form.name.trim()
    if (name === '') return
    patch.mutate(
      { id: item.id, body: { name, entity: form.entity, recordedValue: form.recordedValue } },
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
            campos segue o "Adicionar bem material" da mesma tela, Mockup `925:1433`:
            Nome 458,5 · Entidade 91 · Valor 458,5, em 1040
            (458,5 + 16 + 91 + 16 + 458,5). Nome e valor são as duas colunas ELÁSTICAS que fecham
            a linha — daí `flex-1`, e nenhuma largura em px. */}
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
            <Field label="Valor registrado" className="min-w-0 flex-1">
              {(fieldProps) => (
                <MoneyInput
                  {...fieldProps}
                  value={form.recordedValue}
                  onValueChange={(recordedValue) => setForm((prev) => ({ ...prev, recordedValue }))}
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

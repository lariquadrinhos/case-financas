'use client'

/**
 * The "Direcionar valor" list-and-add editor — files_design/03 "Objeto
 * Direcionamento". Extracted out of `VenderBemMaterialDialog` so "Direcionar
 * agora" (Pendências, files_design/01 §13 / files_design/03 "Pendente de
 * Direcionamento": "abre a mesma escolha de conta que aparecia no modal de
 * venda") can reuse the exact same picker instead of a second implementation
 * of Investimento/Passivo/Receita drifting from this one.
 *
 * O sub-formulário inteiro é o frame 103:21 "Estado — Adicionar Direcionamento
 * (Investimento)" (página Wireframe,
 * docs/figma/frames/103-21__estado-adicionar-direcionamento-investimento.xml):
 * segmented control 103:24, campo de busca 103:31 + "Valor a alocar" 103:38
 * empilhados, a linha 202:20 com o "+ Adicionar" do destino e o rodapé 103:42
 * "Cancelar"/"Direcionar".
 *
 * A LISTA é o frame 99:2 → 103:8, e cada linha dela carrega o par de ações
 * 103:12: "Editar" (103:13, x=0) e "Remover" (103:15, x=62). Não há variante
 * dessa linha por Tipo em nenhum dos 130 frames do Wireframe nem no Mockup
 * 991:2131 — files_design/03 "Objeto Direcionamento" e files_design/01 §11
 * dizem o mesmo em palavras ("Editar/Remover cada um"). Esta lista só tinha
 * "Remover", para nenhum Tipo.
 *
 * Por isso o lançamento de Receita também NÃO nasce no "Direcionar" (103:46):
 * a lista é rascunho até o "Confirmar" do modal que hospeda este editor, e é
 * lá que o `POST /entries` sai — senão "Editar" reabriria uma alocação cujo
 * lançamento já existe e "Remover" o deixaria órfão no Histórico.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { DateField } from '@/components/patterns/date-field'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { SearchCreateField } from '@/components/patterns/search-create-field'
import { StatusFieldHelp } from '@/components/patterns/field-help'
import { ALLOCATION_KINDS, LABEL_ALLOCATION_KIND, type AllocationKind } from '@/domain/assets'
import { normalizeForSearch } from '@/domain/chart-of-accounts'
import { ZERO, add, formatMoney, type Cents } from '@/domain/core'
import { fitsWithinRemaining } from '../allocation-rules'
import { investments } from '../investments'
import { InvestmentForm } from '../investment-form'
import { liabilities } from '../liabilities'
import { LiabilityForm } from '../liability-form'
import { categories } from '../chart-of-accounts'
import { bankAccounts } from '../bank-accounts'
import { todayIsoDate } from '../today'

/** Os campos da Receita coletados no sub-formulário, guardados até o
 * "Confirmar" do modal hospedeiro postar `POST /entries` — ver topo do
 * arquivo. `amount` não se repete aqui: é o `amount` do próprio
 * Direcionamento, e o Editar pode mudá-lo. */
export interface DraftRevenue {
  readonly date: string
  readonly status: 'Planned' | 'Paid'
  readonly entity: 'PF' | 'PJ'
  readonly categoryId: string
  readonly bankAccountId: string
}

export interface DraftAllocation {
  readonly id: string
  readonly kind: AllocationKind
  readonly target: string | null
  /** O nome do destino, separado de `label` para o Editar re-semear o campo
   * de busca sem ter que re-parsear `label`. */
  readonly targetLabel: string | null
  readonly amount: Cents
  readonly label: string
  /** Não-nulo só no kind Receita. */
  readonly revenue: DraftRevenue | null
}

const STATUS_OPTIONS = [
  { value: 'Planned' as const, label: 'Previsto' },
  { value: 'Paid' as const, label: 'Recebido' },
]
const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

export function AllocationEditor({
  allocations,
  remaining,
  onAdd,
  onEdit,
  onRemove,
}: {
  allocations: readonly DraftAllocation[]
  remaining: Cents
  onAdd: (draft: DraftAllocation) => void
  /** Substitui o rascunho de mesmo `id` — Figma 99:2 → 103:13 "Editar". */
  onEdit: (draft: DraftAllocation) => void
  onRemove: (id: string) => void
}) {
  const [addingOpen, setAddingOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  return (
    <div className="flex flex-col gap-8">
      {allocations.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {allocations.map((allocation) =>
            editingId === allocation.id ? (
              <li key={allocation.id} className="py-4">
                <AddAllocationForm
                  // O item em edição sai do "Restante": senão o próprio valor
                  // dele, já contado, encolheria o teto que ele pode manter.
                  remaining={add(remaining, allocation.amount)}
                  editing={allocation}
                  onCancel={() => setEditingId(null)}
                  onAdd={(draft) => {
                    onEdit(draft)
                    setEditingId(null)
                  }}
                />
              </li>
            ) : (
              <li
                key={allocation.id}
                className="flex h-[var(--height-table-row)] items-center justify-between border-b border-line-default text-style-body-md text-ink-primary last:border-0"
              >
                <span>{allocation.label}</span>
                <div className="flex items-center gap-12">
                  <span className="text-style-numeric-md">{formatMoney(allocation.amount)}</span>
                  {/* Figma 99:2 → 103:12: "Editar" (103:13) à esquerda de
                      "Remover" (103:15), nos três Tipos. */}
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={() => setEditingId(allocation.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    size="compact"
                    className="text-ink-negative"
                    onClick={() => onRemove(allocation.id)}
                  >
                    Remover
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {addingOpen ? (
        <AddAllocationForm
          remaining={remaining}
          onCancel={() => setAddingOpen(false)}
          onAdd={(draft) => {
            onAdd(draft)
            setAddingOpen(false)
          }}
        />
      ) : (
        <Button variant="secondary" width="full" onClick={() => setAddingOpen(true)}>
          + Adicionar Direcionamento
        </Button>
      )}
    </div>
  )
}

function AddAllocationForm({
  remaining,
  onAdd,
  onCancel,
  editing,
}: {
  remaining: Cents
  onAdd: (draft: DraftAllocation) => void
  onCancel: () => void
  /** Preenchido só pela ação "Editar" (Figma 99:2 → 103:13): semeia cada
   * campo a partir do rascunho existente em vez de começar em branco, e
   * `handleAdd` devolve o MESMO `id`, para substituir em vez de acrescentar.
   * Vale para os três Tipos — 103:8 não tem variante por Tipo. */
  editing?: DraftAllocation
}) {
  const [kind, setKind] = React.useState<AllocationKind>(editing?.kind ?? 'Investment')
  // Figma 202:20 + nota 103:37: a linha "+ Adicionar" troca de lugar com o
  // formulário completo de cadastro do destino enquanto ele está aberto.
  const [creatingTarget, setCreatingTarget] = React.useState(false)
  const [amount, setAmount] = React.useState<Cents>(editing?.amount ?? ZERO)
  const [error, setError] = React.useState<string | undefined>(undefined)

  // Investimento — "busca/cria inline" (files_design/03). O "cria" NÃO é um
  // formulário reduzido: a nota 103:37 do frame 103:21 diz, palavra por
  // palavra, que o "+ Adicionar" do destino "Abre o formulário completo de
  // cadastro de investimento já existente no produto" — por isso o
  // `SearchCreateField` abaixo é busca pura (sem `onCreate`) e a criação mora
  // na linha 202:20, que monta o `InvestmentForm` de verdade.
  const investmentList = investments.useList()
  const [investmentQuery, setInvestmentQuery] = React.useState('')
  const [investmentTarget, setInvestmentTarget] = React.useState<{
    id: string
    label: string
  } | null>(
    editing?.kind === 'Investment' && editing.target
      ? { id: editing.target, label: editing.targetLabel ?? '' }
      : null,
  )

  // Passivo — busca/filtra igual a Investimento e Categoria
  // (files_design/03 "Objeto Direcionamento": "mesmo padrão de busca/criar
  // categoria — lista completa ao clicar, filtra ao digitar") E cria igual,
  // pelo mesmo caminho: a nota 103:47 do frame 103:21 diz "Passivo funciona
  // igual (buscar + adicionar passivo)". Os 10 campos obrigatórios de um
  // Passivo (files_design/03 "Passivos") são o MOTIVO de o desenho mandar
  // abrir o cadastro completo (103:37), não um motivo para não ter criação.
  const liabilityList = liabilities.useList()
  const [liabilityQuery, setLiabilityQuery] = React.useState('')
  const [liabilityTarget, setLiabilityTarget] = React.useState<{
    id: string
    label: string
  } | null>(
    editing?.kind === 'Liability' && editing.target
      ? { id: editing.target, label: editing.targetLabel ?? '' }
      : null,
  )

  // Receita — "abre o formulário de Receita já existente" (files_design/01 §11).
  // Sem mutação aqui: quem posta é o "Confirmar" do modal hospedeiro (ver topo
  // do arquivo) — é o que deixa "Editar" (103:13) valer também para este Tipo.
  const categoryList = categories.useList()
  const bankAccountList = bankAccounts.useList()
  const [revenueStatus, setRevenueStatus] = React.useState<'Planned' | 'Paid'>(
    editing?.revenue?.status ?? 'Paid',
  )
  const [revenueEntity, setRevenueEntity] = React.useState<'PF' | 'PJ'>(
    editing?.revenue?.entity ?? 'PF',
  )
  const [revenueDate, setRevenueDate] = React.useState<string>(
    editing?.revenue?.date ?? todayIsoDate(),
  )
  const [categoryQuery, setCategoryQuery] = React.useState('')
  const [categoryTarget, setCategoryTarget] = React.useState<{ id: string; label: string } | null>(
    editing?.revenue ? { id: editing.revenue.categoryId, label: editing.targetLabel ?? '' } : null,
  )
  const [bankAccountId, setBankAccountId] = React.useState<string | undefined>(
    editing?.revenue?.bankAccountId,
  )

  const investmentItems = (investmentList.data?.data ?? []).map((item) => ({
    id: item.id,
    label: item.name,
  }))
  const matchingInvestments =
    investmentQuery.trim() === ''
      ? investmentItems
      : investmentItems.filter((item) =>
          item.label.toLowerCase().includes(investmentQuery.trim().toLowerCase()),
        )

  const liabilityItems = (liabilityList.data?.data ?? []).map((item) => ({
    id: item.id,
    label: item.name,
  }))
  const matchingLiabilities =
    liabilityQuery.trim() === ''
      ? liabilityItems
      : liabilityItems.filter((item) =>
          item.label.toLowerCase().includes(liabilityQuery.trim().toLowerCase()),
        )

  // Same normalisation `src/domain/chart-of-accounts/rules.ts` uses for the
  // duplicate check (`normalizeForSearch`) — not the domain's own
  // `searchCategories`, which is typed over branded domain ids and this screen
  // only ever holds the wire (plain-string-id) shape of a Category.
  const categoryNeedle = normalizeForSearch(categoryQuery)
  const matchingCategories = (categoryList.data?.data ?? [])
    .filter((category) => !category.archived)
    .filter((category) => normalizeForSearch(category.name).includes(categoryNeedle))
    .map((category) => ({ id: category.id, label: category.name }))

  function handleAdd() {
    if (!fitsWithinRemaining(amount, remaining)) {
      setError(
        amount <= 0
          ? 'Informe um valor maior que zero.'
          : 'O valor a alocar não pode ser maior que o Restante.',
      )
      return
    }

    if (kind === 'Investment') {
      if (investmentTarget === null) {
        setError('Selecione ou crie um investimento de destino.')
        return
      }
      setError(undefined)
      onAdd({
        id: editing?.id ?? crypto.randomUUID(),
        kind: 'Investment',
        target: investmentTarget.id,
        targetLabel: investmentTarget.label,
        amount,
        label: `${LABEL_ALLOCATION_KIND.Investment}: ${investmentTarget.label}`,
        revenue: null,
      })
      return
    }

    if (kind === 'Liability') {
      if (liabilityTarget === null) {
        setError('Selecione ou crie um passivo de destino.')
        return
      }
      setError(undefined)
      onAdd({
        id: editing?.id ?? crypto.randomUUID(),
        kind: 'Liability',
        target: liabilityTarget.id,
        targetLabel: liabilityTarget.label,
        amount,
        label: `${LABEL_ALLOCATION_KIND.Liability}: ${liabilityTarget.label}`,
        revenue: null,
      })
      return
    }

    // Revenue
    if (categoryTarget === null || bankAccountId === undefined) {
      setError('Preencha categoria e conta para a receita.')
      return
    }
    setError(undefined)
    onAdd({
      id: editing?.id ?? crypto.randomUUID(),
      kind: 'Revenue',
      target: null,
      targetLabel: categoryTarget.label,
      amount,
      label: `${LABEL_ALLOCATION_KIND.Revenue}: ${categoryTarget.label}`,
      revenue: {
        date: revenueDate,
        status: revenueStatus,
        entity: revenueEntity,
        categoryId: categoryTarget.id,
        bankAccountId,
      },
    })
  }

  return (
    <div className="flex flex-col gap-16 rounded-control border border-line-default p-16">
      {editing ? (
        // Tipo não muda em Editar: trocar de Investimento para Passivo no
        // meio da edição reabriria a pergunta de destino do zero, e nenhuma
        // fonte descreve uma migração de tipo aqui.
        <p className="text-style-body-sm text-ink-secondary">
          Tipo: <span className="text-ink-primary">{LABEL_ALLOCATION_KIND[kind]}</span>
        </p>
      ) : (
        <Field label="Tipo" required={false} className="w-fit">
          {(fieldProps) => (
            <SegmentedControl
              {...fieldProps}
              aria-label="Tipo"
              options={ALLOCATION_KINDS.map((value) => ({
                value,
                label: LABEL_ALLOCATION_KIND[value],
              }))}
              value={kind}
              onValueChange={setKind}
            />
          )}
        </Field>
      )}

      {kind === 'Investment' ? (
        <div className="flex flex-col gap-16">
          <Field label="Destino">
            {(fieldProps) => (
              <SearchCreateField
                {...fieldProps}
                items={matchingInvestments}
                query={investmentTarget ? investmentTarget.label : investmentQuery}
                onQueryChange={(value) => {
                  setInvestmentTarget(null)
                  setInvestmentQuery(value)
                }}
                onSelect={(item) => setInvestmentTarget(item)}
                // Figma 103:34, palavra por palavra.
                placeholder="Clique para ver a lista de investimentos…"
              />
            )}
          </Field>
          <Field label="Valor a alocar" required={false}>
            {(fieldProps) => (
              <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />
            )}
          </Field>
        </div>
      ) : null}

      {kind === 'Liability' ? (
        <div className="flex flex-col gap-16">
          <Field label="Destino">
            {(fieldProps) => (
              <SearchCreateField
                {...fieldProps}
                items={matchingLiabilities}
                query={liabilityTarget ? liabilityTarget.label : liabilityQuery}
                onQueryChange={(value) => {
                  setLiabilityTarget(null)
                  setLiabilityQuery(value)
                }}
                onSelect={(item) => setLiabilityTarget(item)}
                placeholder="Clique para ver a lista de passivos…"
              />
            )}
          </Field>
          <Field label="Valor a alocar" required={false}>
            {(fieldProps) => (
              <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />
            )}
          </Field>
        </div>
      ) : null}

      {/* Figma 202:20 (y=269): divisor 202:21 à esquerda + botão 103:35
          "+ Adicionar" (texto 103:36) encostado à direita. É a via de criação
          do DESTINO, separada do botão que conclui o direcionamento, e a nota
          103:37 diz o que ela abre: "o formulário completo de cadastro … já
          existente no produto" — daí `InvestmentForm` / `LiabilityForm`, os
          mesmos das telas Investimentos e Passivos, e não uma versão
          reduzida. 103:47: "Passivo funciona igual". */}
      {kind !== 'Revenue' ? (
        creatingTarget ? (
          <div className="rounded-control border border-line-default p-16">
            {kind === 'Investment' ? (
              <InvestmentForm
                columns={2}
                onCancel={() => setCreatingTarget(false)}
                onCreated={(created) => {
                  setInvestmentTarget({ id: created.id, label: created.name })
                  setInvestmentQuery('')
                  setCreatingTarget(false)
                }}
              />
            ) : (
              <LiabilityForm
                columns={2}
                onCancel={() => setCreatingTarget(false)}
                onCreated={(created) => {
                  setLiabilityTarget({ id: created.id, label: created.name })
                  setLiabilityQuery('')
                  setCreatingTarget(false)
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-16">
            <div className="flex-1 border-t border-line-default" />
            <Button variant="secondary" onClick={() => setCreatingTarget(true)}>
              + Adicionar
            </Button>
          </div>
        )
      ) : null}

      {kind === 'Revenue' ? (
        <div className="flex flex-col gap-16">
          <div className="grid grid-cols-2 gap-16">
            <Field label="Valor">
              {(fieldProps) => (
                <MoneyInput {...fieldProps} value={amount} onValueChange={setAmount} />
              )}
            </Field>
            <Field label="Data do recebimento">
              {(fieldProps) => (
                <DateField
                  {...fieldProps}
                  value={revenueDate}
                  onChange={(event) => setRevenueDate(event.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <Field label="Categoria">
              {(fieldProps) => (
                <SearchCreateField
                  {...fieldProps}
                  items={matchingCategories}
                  query={categoryTarget ? categoryTarget.label : categoryQuery}
                  onQueryChange={(value) => {
                    setCategoryTarget(null)
                    setCategoryQuery(value)
                  }}
                  onSelect={(item) => setCategoryTarget(item)}
                  placeholder="Buscar categoria…"
                />
              )}
            </Field>
            <Field label="Conta">
              {(fieldProps) => (
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger
                    id={fieldProps.id}
                    aria-describedby={fieldProps['aria-describedby']}
                  />
                  <SelectContent>
                    {(bankAccountList.data?.data.length ?? 0) === 0 ? (
                      <SelectEmpty>Nenhuma conta cadastrada ainda.</SelectEmpty>
                    ) : (
                      bankAccountList.data?.data.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
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
                  value={revenueEntity}
                  onValueChange={setRevenueEntity}
                />
              )}
            </Field>
            <Field
              label="Status"
              required={false}
              className="w-fit"
              labelExtra={<StatusFieldHelp />}
            >
              {(fieldProps) => (
                <SegmentedControl
                  {...fieldProps}
                  aria-label="Status"
                  options={STATUS_OPTIONS}
                  value={revenueStatus}
                  onValueChange={setRevenueStatus}
                />
              )}
            </Field>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-style-body-sm text-ink-negative">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-8">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        {/* Figma 103:45/103:46: o par do rodapé conclui em "Direcionar", não
            em "Adicionar" — que é o botão de criar o DESTINO, na linha
            202:20 acima. */}
        <Button variant="primary" onClick={handleAdd}>
          {editing ? 'Salvar' : 'Direcionar'}
        </Button>
      </div>
    </div>
  )
}

'use client'

import * as React from 'react'

import {
  LABEL_STATUS,
  ZERO,
  isoDate,
  monthOf,
  type Cents,
  type Classification,
  type Entity,
  type EntryStatus,
  type Month,
} from '@/domain/core'
import { Switch } from '@/components/ui/switch'
import { BLOCK_IDS } from '@/domain/chart-of-accounts'
import { Field } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { DateField, MonthField } from '@/components/patterns/date-field'
import { FieldSection } from '@/components/patterns/field-section'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { ClassificationFieldHelp, StatusFieldHelp } from '@/components/patterns/field-help'
import { CategoryField } from '@/components/patterns/category-field'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  RecurrenceFields,
  RECURRENCE_OFF,
  type RecurrenceFormValue,
} from '@/components/patterns/recurrence-fields'
import type { BankAccount, Category, StatementBlock } from '@/features/novo-lancamento/types'

export type ExpenseOrRevenue = 'Expense' | 'Revenue'

export interface ExpenseRevenueFormState {
  readonly amount: Cents
  readonly date: string
  readonly status: EntryStatus
  readonly entity: Entity
  readonly categoryId: string
  readonly categoryName: string
  readonly classification: Classification
  readonly bankAccountId: string
  readonly recurrence: RecurrenceFormValue
  /** "Cartão de crédito" — Despesa (ADR-0021) and Receita, e.g. a card refund (2026-10-09). */
  readonly isCreditCard: boolean
  /** "Contabilizar em" — Despesa only; `null` is the payment month (ADR-0021). */
  readonly accountingMonth: Month | null
}

export function defaultExpenseRevenueState(today: string): ExpenseRevenueFormState {
  return {
    amount: ZERO,
    date: today,
    // Previsto by default (owner's request, 2026-10-01; files_design/03 said
    // "Pago"/"Recebido"). On an account linked to Open Finance a manual Pago
    // is refused (ADR-0020 §3) — the bank pays the Previsto when it posts.
    status: 'Planned',
    entity: 'PF',
    categoryId: '',
    categoryName: '',
    classification: 'Current',
    bankAccountId: '',
    recurrence: RECURRENCE_OFF,
    isCreditCard: false,
    accountingMonth: null,
  }
}

/** The month of the payment date, or `null` while the date is incomplete. */
function paymentMonthOf(date: string): Month | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? monthOf(isoDate(date)) : null
}

const ENTITY_OPTIONS = [
  { value: 'PF' as const, label: 'PF' },
  { value: 'PJ' as const, label: 'PJ' },
]

const CLASSIFICATION_OPTIONS = [
  { value: 'Current' as const, label: 'Circulante' },
  { value: 'NonCurrent' as const, label: 'Não circulante' },
]

const HELPER_TEXT: Record<ExpenseOrRevenue, string> = {
  Expense:
    'Despesa: qualquer gasto que saiu ou vai sair da sua conta, inclusive compra no crédito ' +
    '(marque Previsto até a fatura ser realmente paga).',
  Revenue:
    'Receita: qualquer dinheiro que entra ou vai entrar na sua conta, que não seja transferência ' +
    'entre PJ e PF.',
}

export interface ExpenseRevenueErrors {
  categoryId?: string
  bankAccountId?: string
  recurrenceEndsOn?: string
}

export function ExpenseRevenueFields({
  kind,
  value,
  onChange,
  categories,
  blocks,
  bankAccounts,
  onCreateCategory,
  creatingCategory,
  errors,
  editingExisting = false,
  seriesSlot,
}: {
  kind: ExpenseOrRevenue
  value: ExpenseRevenueFormState
  onChange: (next: ExpenseRevenueFormState) => void
  categories: readonly Category[]
  blocks: readonly StatementBlock[]
  bankAccounts: readonly BankAccount[]
  onCreateCategory: (name: string, blockId: string) => Promise<Category | null>
  creatingCategory: boolean
  errors: ExpenseRevenueErrors
  /**
   * `PATCH /entries/{id}` never touches the Recorrência link — "the série
   * link is managed through the recurrence endpoints, never rewritten by a
   * plain field edit here" (`src/app/api/v1/entries/[id]/route.ts`). Editing
   * an existing lançamento therefore shows a note instead of a live toggle.
   */
  editingExisting?: boolean
  /**
   * Editing one month of a série (2026-10-01): replaces the Recorrência note
   * with the "Aplicar esta mudança a" choice, hides Status (the month is a
   * Previsto) and locks the Data (an occurrence's date is the series').
   */
  seriesSlot?: React.ReactNode
}) {
  const statusOptions = [
    { value: 'Planned' as const, label: LABEL_STATUS[kind].Planned },
    { value: 'Paid' as const, label: LABEL_STATUS[kind].Paid },
  ]

  // P34 (produto, 2026-09-08): aqui o bloco é PERGUNTADO.
  //
  // O Wireframe `47:2` nota `47:27` diz "confirma direto: bloco já é o de onde
  // a pessoa clicou", e isso vale no Plano de Contas, onde esse clique existe
  // (`44:88`). Neste formulário ele não existe, e a derivação que havia aqui —
  // Despesa PJ → Despesas Administrativas, Despesa PF → Despesas
  // Pessoais/Consumo — foi descartada porque a premissa dela é falsa: os blocos
  // NÃO se dividem por entidade. Na planilha de referência, o bloco 4 é só
  // custo fixo de casa (aluguel moradia, plano de saúde, água, luz) e o custo
  // da PJ mora no bloco 3 (Contador, internet, assinaturas). A divisão real é
  // custo fixo × consumo variável.
  //
  // O que torna o palpite inaceitável e não só impreciso: categoria NUNCA muda
  // de bloco (`categoryPatchSchema` não aceita `blockId`). Um bloco errado é
  // permanente, e a única saída é arquivar e recriar.
  //
  // Receita continua sem pergunta: só Receita Bruta aceita receita.
  //
  // D&A fica fora da lista — é o único bloco que não aceita categoria.
  const receitaBruta = blocks.find((block) => block.id === BLOCK_IDS.grossRevenue) ?? {
    id: BLOCK_IDS.grossRevenue as string,
    name: '',
  }
  // Numerados, como o Plano de Contas e o Mockup escrevem: `${order}. ${name}`.
  //
  // Fora da lista, além de D&A: RECEITA BRUTA. Não é preferência — é
  // correção. Uma Despesa contribui negativo (`effectInView`), e o bloco 1
  // soma; uma categoria de despesa ali REDUZIRIA a receita bruta, que é um
  // número sem sentido. O filtro é pelo efeito, não pelo nome.
  const blocosParaEscolher =
    kind === 'Revenue'
      ? undefined
      : blocks
          .filter((block) => block.acceptsUserCategories && block.effect !== 'Add')
          .map((block) => ({ id: block.id, name: `${block.order}. ${block.name}` }))

  return (
    <div className="flex flex-col gap-20">
      <p className="text-style-body-sm text-ink-secondary">{HELPER_TEXT[kind]}</p>

      <FieldSection title="Informações Básicas" first>
        <Field label="Valor">
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={value.amount}
              onValueChange={(amount) => onChange({ ...value, amount })}
            />
          )}
        </Field>

        <Field label={kind === 'Expense' ? 'Data de pagamento' : 'Data do recebimento'}>
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <DateField
              disabled={seriesSlot !== undefined}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={value.date}
              onChange={(event) => onChange({ ...value, date: event.target.value })}
            />
          )}
        </Field>

        {/* Também na Receita: um estorno pode entrar pelo cartão (dono,
            2026-10-09). O "Contabilizar em" continua só na Despesa. */}
        <div className="flex items-center justify-between gap-16">
          <label htmlFor={`${kind}-credit-card`} className="text-style-body-md text-ink-primary">
            Cartão de crédito
          </label>
          <Switch
            id={`${kind}-credit-card`}
            checked={value.isCreditCard}
            onCheckedChange={(isCreditCard) => onChange({ ...value, isCreditCard })}
          />
        </div>

        {kind === 'Expense' ? (
          <>
            <Field label="Contabilizar em" required={false}>
              {({ id, 'aria-describedby': describedBy }) => (
                <MonthField
                  id={id}
                  aria-describedby={describedBy}
                  // Abre no mês do pagamento enquanto a pessoa não escolhe
                  // outro — num lançamento novo, o mês atual (dono, 2026-10-06).
                  value={value.accountingMonth ?? paymentMonthOf(value.date) ?? ''}
                  onChange={(event) => {
                    const chosen = event.target.value
                    onChange({
                      ...value,
                      // O mês do pagamento é o padrão, não uma escolha: guardado
                      // como `null`, ele acompanha a data se ela mudar.
                      accountingMonth:
                        /^\d{4}-\d{2}$/.test(chosen) && chosen !== paymentMonthOf(value.date)
                          ? (chosen as Month)
                          : null,
                    })
                  }}
                />
              )}
            </Field>
          </>
        ) : null}

        {seriesSlot === undefined ? (
          <Field
            label="Status"
            required={false}
            labelExtra={<StatusFieldHelp paidLabel={LABEL_STATUS[kind].Paid} />}
          >
            {({ id, 'aria-describedby': describedBy }) => (
              <SegmentedControl
                id={id}
                aria-describedby={describedBy}
                value={value.status}
                onValueChange={(status) => onChange({ ...value, status })}
                options={statusOptions}
              />
            )}
          </Field>
        ) : null}

        <Field label="Entidade" required={false}>
          {({ id, 'aria-describedby': describedBy }) => (
            <SegmentedControl
              id={id}
              aria-describedby={describedBy}
              value={value.entity}
              onValueChange={(entity) => onChange({ ...value, entity })}
              options={ENTITY_OPTIONS}
            />
          )}
        </Field>
      </FieldSection>

      <FieldSection title="Categorização">
        <Field label="Categoria" error={errors.categoryId}>
          {({ id, 'aria-describedby': describedBy }) => (
            <CategoryField
              id={id}
              aria-describedby={describedBy}
              categories={categories}
              block={receitaBruta}
              blocksToChoose={blocosParaEscolher}
              value={value.categoryName}
              creating={creatingCategory}
              onSelectCategory={(category, suggestion) =>
                onChange({
                  ...value,
                  categoryId: category.id,
                  categoryName: category.name,
                  classification:
                    category.suggestedClassification ?? suggestion ?? value.classification,
                })
              }
              onCreateCategory={onCreateCategory}
            />
          )}
        </Field>

        <Field
          label="Classificação (sugerida)"
          required={false}
          labelExtra={<ClassificationFieldHelp withSuggestionNote />}
        >
          {({ id, 'aria-describedby': describedBy }) => (
            <SegmentedControl
              id={id}
              aria-describedby={describedBy}
              value={value.classification}
              onValueChange={(classification) => onChange({ ...value, classification })}
              options={CLASSIFICATION_OPTIONS}
            />
          )}
        </Field>

        <Field label="Conta" error={errors.bankAccountId}>
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <Select
              value={value.bankAccountId}
              onValueChange={(bankAccountId) => onChange({ ...value, bankAccountId })}
            >
              <SelectTrigger
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="Selecionar conta…"
              />
              <SelectContent>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </FieldSection>

      <FieldSection title="Recorrência">
        {seriesSlot !== undefined ? (
          seriesSlot
        ) : editingExisting ? (
          <p className="text-style-body-sm text-ink-secondary">
            Recorrência não é editada por aqui — use a tela Revisão de Recorrentes.
          </p>
        ) : (
          <>
            <RecurrenceFields
              idPrefix={`recurrence-${kind}`}
              value={value.recurrence}
              onChange={(recurrence) => onChange({ ...value, recurrence })}
              toggleLabel={
                kind === 'Expense'
                  ? 'Este lançamento se repete todo mês'
                  : 'Esta receita se repete todo mês'
              }
            />
            {errors.recurrenceEndsOn ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {errors.recurrenceEndsOn}
              </p>
            ) : null}
          </>
        )}
      </FieldSection>
    </div>
  )
}

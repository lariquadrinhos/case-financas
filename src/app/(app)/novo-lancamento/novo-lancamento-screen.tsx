'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ApiError } from '@/lib/api-client'
import { todayIsoDate } from '@/lib/today'
import { cents, type Month } from '@/domain/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { categoriesForKind } from '@/domain/chart-of-accounts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loading } from '@/components/patterns/loading'
import {
  isNovoLancamentoOrigin,
  type Entry,
  type EntryPatch,
  type NewEntry,
  type NovoLancamentoOrigin,
  type NovoLancamentoTab,
} from '@/features/novo-lancamento/types'
import {
  useBankAccounts,
  useCategories,
  useCreateCategory,
  useCreateEntry,
  useEntry,
  usePatchEntry,
  usePatchSeriesMonth,
  useSeriesMonth,
  useStatementBlocks,
} from '@/features/novo-lancamento/use-novo-lancamento'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { EDIT_SCOPES, LABEL_EDIT_SCOPE, type EditScope } from '@/domain/recurrence'
import { formatMonthName, yearOf } from '@/domain/core'
import { cn } from '@/lib/cn'
import {
  ExpenseRevenueFields,
  defaultExpenseRevenueState,
  type ExpenseRevenueErrors,
  type ExpenseRevenueFormState,
} from './tabs/expense-revenue-fields'
import {
  NO_SOURCE_ACCOUNT,
  ProLaboreFields,
  defaultProLaboreState,
  type ProLaboreErrors,
  type ProLaboreFormState,
} from './tabs/pro-labore-fields'
import {
  IncomeTaxFields,
  defaultIncomeTaxState,
  type IncomeTaxErrors,
  type IncomeTaxFormState,
} from './tabs/income-tax-fields'
import { LinkToBankButton } from '@/features/open-finance/link-to-bank-button'
import { DiscardEntryButton } from '@/features/novo-lancamento/discard-entry-button'
import { entryDisplayName } from '@/features/historico/entry-display'

const TAB_LABEL: Record<NovoLancamentoTab, string> = {
  Expense: 'Despesa',
  Revenue: 'Receita',
  ProLaboreEDistribuicao: 'Pró-labore e Distribuição',
  IncomeTax: 'IR',
}

function originHref(origin: NovoLancamentoOrigin): string {
  return `/${origin}`
}

function tabForEntry(entry: Entry): NovoLancamentoTab {
  switch (entry.kind) {
    case 'Expense':
      return 'Expense'
    case 'Revenue':
      return 'Revenue'
    case 'ProLabore':
    case 'ProfitDistribution':
      return 'ProLaboreEDistribuicao'
    case 'IncomeTax':
      return 'IncomeTax'
  }
}

/** O rótulo de cada campo que a validação pode recusar, para o resumo junto do botão. */
const FIELD_LABEL: Record<string, string> = {
  categoryId: 'Categoria',
  bankAccountId: 'Conta',
  destinationAccountId: 'Conta de destino (PF)',
  recurrenceEndsOn: 'Data de término da recorrência',
}

export function NovoLancamentoScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = React.useMemo(() => todayIsoDate(), [])

  const rawOrigin = searchParams.get('from')
  const origin: NovoLancamentoOrigin = isNovoLancamentoOrigin(rawOrigin) ? rawOrigin : 'inicio'
  const entryId = searchParams.get('entryId')
  // "Editar" num mês de uma série (2026-10-01): o formulário abre com a série,
  // e salvar é o PATCH da ocorrência, com o alcance escolhido como na Revisão.
  const occurrenceId = searchParams.get('occurrenceId')
  const [scope, setScope] = React.useState<EditScope>('ThisOnly')

  const [activeTab, setActiveTab] = React.useState<NovoLancamentoTab>('Expense')
  const [expenseState, setExpenseState] = React.useState(() => defaultExpenseRevenueState(today))
  const [revenueState, setRevenueState] = React.useState(() => defaultExpenseRevenueState(today))
  const [proLaboreState, setProLaboreState] = React.useState(() => defaultProLaboreState(today))
  const [incomeTaxState, setIncomeTaxState] = React.useState(() => defaultIncomeTaxState(today))

  const [expenseErrors, setExpenseErrors] = React.useState<ExpenseRevenueErrors>({})
  const [revenueErrors, setRevenueErrors] = React.useState<ExpenseRevenueErrors>({})
  const [proLaboreErrors, setProLaboreErrors] = React.useState<ProLaboreErrors>({})
  const [incomeTaxErrors, setIncomeTaxErrors] = React.useState<IncomeTaxErrors>({})

  const [submitError, setSubmitError] = React.useState<string | null>(null)
  // "Descrição" (2026-09-29) — um campo só, abaixo das abas, porque vale para
  // qualquer tipo de lançamento; ir aba a aba repetiria o mesmo campo quatro vezes.
  const [description, setDescription] = React.useState('')
  // "Salvar e lançar outro" (2026-09-29): o aviso de salvo aparece no próprio
  // formulário, que continua aberto e limpo — sem a tela intermediária
  // "Lançar outro / Voltar", que custava um clique a mais por lançamento.
  const [savedFlash, setSavedFlash] = React.useState(false)
  // "Lançar outro em seguida" (pedido do dono, 2026-10-01): uma opção que liga
  // e desliga no lugar do segundo botão — um botão de salvar só. Fica ligada
  // entre um lançamento e outro, para lançar vários em sequência.
  const [launchAnother, setLaunchAnother] = React.useState(false)
  const launchAnotherId = React.useId()
  const [prefilled, setPrefilled] = React.useState(false)

  const categoriesQuery = useCategories()
  const blocksQuery = useStatementBlocks()
  const allAccountsQuery = useBankAccounts()
  const pjAccountsQuery = useBankAccounts('PJ')
  const pfAccountsQuery = useBankAccounts('PF')
  const existingEntryQuery = useEntry(entryId)
  const seriesQuery = useSeriesMonth(occurrenceId)
  const patchSeriesMonth = usePatchSeriesMonth()

  const createCategory = useCreateCategory()
  const createEntry = useCreateEntry()
  const patchEntry = usePatchEntry()

  const categories = React.useMemo(() => categoriesQuery.data?.data ?? [], [categoriesQuery.data])
  const categoriesById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const blocks = React.useMemo(
    () => (blocksQuery.data?.data ?? []).filter((block) => block.acceptsUserCategories),
    [blocksQuery.data],
  )
  const allAccounts = React.useMemo(
    () => allAccountsQuery.data?.data ?? [],
    [allAccountsQuery.data],
  )
  const pjAccounts = React.useMemo(() => pjAccountsQuery.data?.data ?? [], [pjAccountsQuery.data])
  const pfAccounts = React.useMemo(() => pfAccountsQuery.data?.data ?? [], [pfAccountsQuery.data])

  const editing = entryId !== null
  const editingSeries = occurrenceId !== null
  const editingAny = editing || editingSeries
  const existingEntry = existingEntryQuery.data ?? null
  const series = seriesQuery.data ?? null

  // Prefill exactly once, when both the entry AND the categories it might
  // reference have loaded (Expense/Revenue need the category's NAME for the
  // Categoria field, which the wire Entry only carries as an id).
  React.useEffect(() => {
    if (!editing || prefilled || existingEntry === null) return
    if (categoriesQuery.isLoading) return

    setActiveTab(tabForEntry(existingEntry))
    setDescription(existingEntry.description ?? '')

    if (existingEntry.kind === 'Expense' || existingEntry.kind === 'Revenue') {
      const category = categories.find((c) => c.id === existingEntry.categoryId)
      const next: ExpenseRevenueFormState = {
        amount: cents(existingEntry.amount),
        date: existingEntry.date,
        status: existingEntry.status,
        entity: existingEntry.entity,
        categoryId: existingEntry.categoryId,
        categoryName: category?.name ?? '',
        classification: existingEntry.classification,
        bankAccountId: existingEntry.bankAccountId,
        recurrence: { active: false, amountKind: 'Fixed', endsOn: null },
        isCreditCard: existingEntry.isCreditCard === true,
        accountingMonth:
          existingEntry.kind === 'Expense' && existingEntry.accountingMonth
            ? (existingEntry.accountingMonth as Month)
            : null,
      }
      if (existingEntry.kind === 'Expense') setExpenseState(next)
      else setRevenueState(next)
    } else if (existingEntry.kind === 'ProLabore' || existingEntry.kind === 'ProfitDistribution') {
      setProLaboreState({
        subKind: existingEntry.kind,
        amount: cents(existingEntry.amount),
        date: existingEntry.date,
        status: existingEntry.status,
        sourceAccountId: existingEntry.sourceAccountId ?? NO_SOURCE_ACCOUNT,
        destinationAccountId: existingEntry.destinationAccountId,
        recurrence: { active: false, amountKind: 'Fixed', endsOn: null },
      })
    } else if (existingEntry.kind === 'IncomeTax') {
      setIncomeTaxState({
        direction: existingEntry.direction,
        entity: existingEntry.entity,
        amount: cents(existingEntry.amount),
        bankAccountId: existingEntry.bankAccountId,
        date: existingEntry.date,
        label: existingEntry.label ?? '',
        recurrence: { active: false, amountKind: 'Fixed', endsOn: null },
      })
    }
    setPrefilled(true)
  }, [editing, prefilled, existingEntry, categoriesQuery.isLoading, categories])

  React.useEffect(() => {
    if (!editingSeries || prefilled || series === null) return
    if (categoriesQuery.isLoading) return
    const { occurrence, recurrence } = series
    const template = recurrence.template
    const month = {
      amount: cents(occurrence.plannedAmount ?? template.amount),
      date: occurrence.plannedDate,
      status: 'Planned' as const,
      recurrence: { active: false, amountKind: 'Fixed' as const, endsOn: null },
    }
    setActiveTab(tabForEntry(template as unknown as Entry))
    setDescription(occurrence.description ?? template.description ?? '')
    if (template.kind === 'Expense' || template.kind === 'Revenue') {
      const category = categories.find((c) => c.id === template.categoryId)
      const next: ExpenseRevenueFormState = {
        ...month,
        entity: template.entity,
        categoryId: template.categoryId,
        categoryName: category?.name ?? '',
        classification: template.classification,
        bankAccountId: template.bankAccountId,
        isCreditCard: template.isCreditCard === true,
        // A série não tem "Contabilizar em" (ADR-0021): cada mês fica no seu.
        accountingMonth: null,
      }
      if (template.kind === 'Expense') setExpenseState(next)
      else setRevenueState(next)
    } else if (template.kind === 'ProLabore' || template.kind === 'ProfitDistribution') {
      setProLaboreState({
        ...month,
        subKind: template.kind,
        sourceAccountId: template.sourceAccountId ?? NO_SOURCE_ACCOUNT,
        destinationAccountId: template.destinationAccountId,
      })
    } else {
      setIncomeTaxState({
        ...month,
        direction: template.direction,
        entity: template.entity,
        bankAccountId: template.bankAccountId,
        label: template.label ?? '',
      })
    }
    setPrefilled(true)
  }, [editingSeries, prefilled, series, categoriesQuery.isLoading, categories])

  function buildRecurrence(recurrence: {
    active: boolean
    amountKind: 'Fixed' | 'ToBeDefined'
    endsOn: string | null
  }) {
    if (!recurrence.active) return null
    return {
      amountKind: recurrence.amountKind,
      endsOn: recurrence.endsOn === null || recurrence.endsOn === '' ? null : recurrence.endsOn,
    }
  }

  function recurrenceEndsOnError(recurrence: {
    active: boolean
    endsOn: string | null
  }): string | undefined {
    if (recurrence.active && recurrence.endsOn === '') {
      return 'Informe a data de término ou desligue "Definir data de término".'
    }
    return undefined
  }

  async function handleCreateCategory(name: string, blockId: string) {
    try {
      const created = await createCategory.mutateAsync({
        blockId,
        name,
        suggestedClassification: null,
      })
      // The list also refetches via the mutation's own invalidation, but
      // `CategoryField.handleCreate` (src/components/patterns/category-field.tsx)
      // needs the created category back synchronously to select it right
      // away — returning it here is what lets that happen without waiting on
      // a second render from the invalidated `categories` query.
      return created
    } catch (error) {
      setSubmitError(messageFor(error))
      return null
    }
  }

  function validateExpenseRevenue(state: ExpenseRevenueFormState): ExpenseRevenueErrors {
    const errors: ExpenseRevenueErrors = {}
    if (state.categoryId === '') errors.categoryId = 'Selecione ou crie uma categoria.'
    if (state.bankAccountId === '') errors.bankAccountId = 'Selecione uma conta.'
    const recurrenceError = recurrenceEndsOnError(state.recurrence)
    if (recurrenceError) errors.recurrenceEndsOn = recurrenceError
    return errors
  }

  function validateProLabore(state: ProLaboreFormState): ProLaboreErrors {
    const errors: ProLaboreErrors = {}
    if (state.destinationAccountId === '') {
      errors.destinationAccountId = 'Selecione a conta de destino.'
    }
    const recurrenceError = recurrenceEndsOnError(state.recurrence)
    if (recurrenceError) errors.recurrenceEndsOn = recurrenceError
    return errors
  }

  function validateIncomeTax(state: IncomeTaxFormState): IncomeTaxErrors {
    const errors: IncomeTaxErrors = {}
    if (state.bankAccountId === '') errors.bankAccountId = 'Selecione uma conta.'
    const recurrenceError = recurrenceEndsOnError(state.recurrence)
    if (recurrenceError) errors.recurrenceEndsOn = recurrenceError
    return errors
  }

  function hasErrors(errors: object): boolean {
    const failed = Object.entries(errors).filter(([, message]) => message !== undefined)
    if (failed.length > 0) {
      // Relato de 2026-09-29: sem a conta de destino, "Salvar" não fazia nada
      // visível — o erro ficava embaixo do campo, lá em cima do diálogo, e
      // nenhuma requisição saía. Agora o resumo aparece AO LADO do botão.
      const fields = failed.map(([key]) => FIELD_LABEL[key] ?? key)
      setSubmitError(`O lançamento não foi salvo. Falta preencher: ${fields.join(', ')}.`)
    }
    return failed.length > 0
  }

  async function handleSubmit(andAnother = false) {
    setSubmitError(null)
    setSavedFlash(false)

    if (activeTab === 'Expense' || activeTab === 'Revenue') {
      const state = activeTab === 'Expense' ? expenseState : revenueState
      const setErrors = activeTab === 'Expense' ? setExpenseErrors : setRevenueErrors
      const errors = validateExpenseRevenue(state)
      setErrors(errors)
      if (hasErrors(errors)) return

      const body: NewEntry = {
        kind: activeTab,
        amount: state.amount,
        date: state.date,
        status: state.status,
        entity: state.entity,
        categoryId: state.categoryId,
        classification: state.classification,
        bankAccountId: state.bankAccountId,
        recurrence: editing ? null : buildRecurrence(state.recurrence),
        isCreditCard: state.isCreditCard,
        ...(activeTab === 'Expense' ? { accountingMonth: state.accountingMonth } : {}),
      } as NewEntry

      await saveEntry(
        body,
        () =>
          activeTab === 'Expense'
            ? setExpenseState(defaultExpenseRevenueState(today))
            : setRevenueState(defaultExpenseRevenueState(today)),
        { andAnother },
      )
      return
    }

    if (activeTab === 'ProLaboreEDistribuicao') {
      const errors = validateProLabore(proLaboreState)
      setProLaboreErrors(errors)
      if (hasErrors(errors)) return

      const body: NewEntry = {
        kind: proLaboreState.subKind,
        amount: proLaboreState.amount,
        date: proLaboreState.date,
        status: proLaboreState.status,
        // ADR-0018: nada escolhido, ou "Sem conta de origem", vai como null.
        sourceAccountId:
          proLaboreState.sourceAccountId === '' ||
          proLaboreState.sourceAccountId === NO_SOURCE_ACCOUNT
            ? null
            : proLaboreState.sourceAccountId,
        destinationAccountId: proLaboreState.destinationAccountId,
        recurrence: editing ? null : buildRecurrence(proLaboreState.recurrence),
      } as NewEntry

      await saveEntry(body, () => setProLaboreState(defaultProLaboreState(today)), { andAnother })
      return
    }

    if (activeTab === 'IncomeTax') {
      const errors = validateIncomeTax(incomeTaxState)
      setIncomeTaxErrors(errors)
      if (hasErrors(errors)) return

      const body: NewEntry = {
        kind: 'IncomeTax',
        direction: incomeTaxState.direction,
        entity: incomeTaxState.entity,
        amount: incomeTaxState.amount,
        // See the comment on the Pró-labore payload above — IR has no Status
        // control either, and the contract's default is `Paid`.
        status: 'Paid',
        bankAccountId: incomeTaxState.bankAccountId,
        date: incomeTaxState.date,
        label: incomeTaxState.label.trim() === '' ? null : incomeTaxState.label.trim(),
        recurrence: editing ? null : buildRecurrence(incomeTaxState.recurrence),
      } as NewEntry

      await saveEntry(body, () => setIncomeTaxState(defaultIncomeTaxState(today)), {
        omitStatusOnPatch: true,
        andAnother,
      })
    }
  }

  async function saveEntry(
    body: NewEntry,
    resetTab: () => void,
    options?: { omitStatusOnPatch?: boolean; andAnother?: boolean },
  ) {
    body = { ...body, description: description.trim() === '' ? null : description.trim() }
    try {
      if (editingSeries && occurrenceId !== null && series !== null) {
        const {
          date: _date,
          status: _status,
          recurrence: _recurrence,
          description: newDescription,
          accountingMonth: _accountingMonth,
          isCreditCard,
          ...fields
        } = body as NewEntry & {
          recurrence?: unknown
          accountingMonth?: unknown
          isCreditCard?: boolean
        }
        // A série não tem "Contabilizar em", e o "Cartão de crédito" desligado é
        // a ausência do campo, como o servidor devolve (ADR-0021) — senão a
        // comparação abaixo veria uma mudança que a pessoa não fez.
        const template = {
          ...fields,
          ...(isCreditCard ? { isCreditCard: true } : {}),
          description: newDescription,
        } as typeof series.recurrence.template
        // "Só esta ocorrência" leva os dados da série só se a pessoa os mudou —
        // e aí o servidor responde com a frase que diz para escolher "Toda a série".
        const seriesFieldsOf = (t: Record<string, unknown>) =>
          JSON.stringify(
            Object.fromEntries(
              Object.entries(t)
                .filter(([key]) => key !== 'amount' && key !== 'description')
                .sort(([a], [b]) => (a < b ? -1 : 1)),
            ),
          )
        const changedSeries =
          seriesFieldsOf(template as Record<string, unknown>) !==
          seriesFieldsOf(series.recurrence.template as unknown as Record<string, unknown>)
        await patchSeriesMonth.mutateAsync({
          id: occurrenceId,
          body: {
            plannedAmount: body.amount,
            description: newDescription ?? null,
            scope,
            ...(scope === 'WholeSeries' || changedSeries ? { template } : {}),
          },
        })
        router.push(originHref(origin))
        return
      }
      if (editing && entryId !== null) {
        // `EntryPatch` is the same per-kind field set as `NewEntry`, just with
        // every field but `kind` optional — a fully-populated `NewEntry`
        // always satisfies it (files_design/03: the edit form is the SAME
        // fields as create, just pre-filled). Pró-labore/Distribuição and IR
        // have no Status control at all (files_design/03), so their `status`
        // here is only the CREATE default ("Paid") — sending it on a PATCH
        // would silently overwrite whatever the entry's real status is, so it
        // is left out of the partial update instead.
        const patchBody: EntryPatch = options?.omitStatusOnPatch
          ? (Object.fromEntries(
              Object.entries(body).filter(([key]) => key !== 'status'),
            ) as unknown as EntryPatch)
          : (body as unknown as EntryPatch)
        await patchEntry.mutateAsync({ id: entryId, body: patchBody })
        router.push(originHref(origin))
        return
      }
      await createEntry.mutateAsync(body)
      if (!options?.andAnother) {
        router.push(originHref(origin))
        return
      }
      resetTab()
      setDescription('')
      setSavedFlash(true)
    } catch (error) {
      setSubmitError(messageFor(error))
    }
  }

  function handleBack() {
    router.push(originHref(origin))
  }

  // A aba Despesa só oferece categoria de bloco que aceita despesa, e a Receita
  // só a de bloco que aceita receita (`blockAcceptsKind`). Medido em
  // 2026-09-29: "Salário/Pró-labore" (Receita Bruta) escolhida na aba Despesa
  // virou despesa DENTRO da Receita Bruta e aparecia negativa no DRE. O
  // servidor também recusa (`entries.category_kind_mismatch`); aqui a opção
  // errada nem aparece.
  const categoriesFor = (kind: 'Expense' | 'Revenue') =>
    categoriesForKind(categories, blocksQuery.data?.data ?? [], kind)

  const saving = createEntry.isPending || patchEntry.isPending || patchSeriesMonth.isPending
  const loadingExisting =
    (editing && !existingEntryQuery.isError && (existingEntryQuery.isLoading || !prefilled)) ||
    (editingSeries && !seriesQuery.isError && (seriesQuery.isLoading || !prefilled))

  // "Aplicar esta mudança a" — o mesmo par de opções do "Editar" da Revisão
  // (files_design/01 §6, Figma 34:21), agora no formulário inteiro.
  const seriesMonth = series?.occurrence.month ?? null
  const seriesSlot =
    editingSeries && seriesMonth !== null ? (
      <div className="flex flex-col gap-8">
        <p className="text-style-body-md font-medium text-ink-primary">Aplicar esta mudança a:</p>
        <RadioGroupPrimitive.Root
          value={scope}
          onValueChange={(value) => setScope(value as EditScope)}
          aria-label="Aplicar esta mudança a"
          className="flex flex-col gap-8"
        >
          {EDIT_SCOPES.map((option) => (
            <RadioGroupPrimitive.Item
              key={option}
              value={option}
              className={cn(
                'flex h-[var(--height-control)] w-full items-center rounded-control border px-16 text-left',
                'text-style-body-md text-ink-primary outline-none transition-colors',
                'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
                scope === option
                  ? 'border-line-focus bg-surface-state'
                  : 'border-line-default hover:bg-surface-hover',
              )}
            >
              {option === 'ThisOnly'
                ? `${LABEL_EDIT_SCOPE.ThisOnly} (${formatMonthName(seriesMonth)}/${yearOf(seriesMonth)})`
                : LABEL_EDIT_SCOPE.WholeSeries}
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
        <p className="text-style-body-sm text-ink-secondary">
          Só esta ocorrência muda o valor e a descrição. Categoria, conta e entidade mudam com Toda
          a série; os meses já pagos não mudam.
        </p>
      </div>
    ) : undefined

  // Um gasto de Consumo Livre se edita aqui como qualquer despesa (dono,
  // 2026-10-06: a tela que mandava "editar pelo widget, na Home" "não faz
  // sentido" — o "Editar" do DRE nunca editava). Trocar a categoria o tira do
  // widget (PATCH /entries/{id}).

  return (
    <>
      {/* Novo Lançamento é um DIÁLOGO sobre a tela atual, nunca uma tela cheia
          própria. Medido no Mockup: o frame `872:592` é `872:593` "Backdrop
          (Início)" + `872:826` "Scrim" + `872:1305` "Modal — Novo Lançamento",
          480×1144 em x=616 (centro 856 = centro da área de conteúdo 272..1440).
          O título `872:1306` fica DENTRO do contêiner, em x=24 y=24, e as abas
          `872:1307` em y=60 — os 24 de padding e os 16 até as abas que
          `DialogHeader` (`p-24 pb-16`) já reproduz. O Wireframe desenha o mesmo
          (`262:1120` scrim + `6:29`, 480×1134, título `6:31` dentro).
          files_design/02 "Log de decisões de UX": "abre como painel/modal
          flutuante sobre o conteúdo atual (não troca a tela inteira)";
          files_design/07 regra de processo 10: "nunca como tela cheia própria".

          O que ainda diverge do frame e depende de decisão: aqui o diálogo é
          montado pela rota `/novo-lancamento`, então atrás do scrim fica a
          barra lateral e a área de conteúdo vazia, não a Início desenhada em
          `872:593`. Manter o contexto real atrás exige rota interceptada
          (`@modal/(.)novo-lancamento`) — mudança arquitetural, logo ADR. */}
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) handleBack()
        }}
      >
        {/* O texto de apoio do frame é a legenda da aba (`872:1316`), que vive
            dentro do painel da aba ativa e troca junto com ela — não há um
            parágrafo fixo sob o título para o Radix apontar. */}
        <DialogContent width="narrow" aria-describedby={undefined}>
          <DialogHeader>
            {/* Em edição o título diz isso: com "Novo Lançamento" a pessoa lia a
                tela de edição como criação de um segundo lançamento e fechava
                sem salvar (relato de 2026-09-23). */}
            <DialogTitle>
              {editingSeries
                ? 'Editar Recorrência'
                : editing
                  ? 'Editar Lançamento'
                  : 'Novo Lançamento'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="pb-24">
            {loadingExisting ? (
              <Loading label="Carregando lançamento" />
            ) : (editing && existingEntryQuery.isError) ||
              (editingSeries && seriesQuery.isError) ? (
              <div className="flex flex-col gap-16">
                <p className="text-style-body-md text-ink-primary">
                  Não foi possível carregar este lançamento.
                </p>
                <Button variant="secondary" onClick={handleBack} className="self-start">
                  Voltar
                </Button>
              </div>
            ) : (
              <>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NovoLancamentoTab)}>
                  <TabsList>
                    {(['Expense', 'Revenue', 'ProLaboreEDistribuicao', 'IncomeTax'] as const).map(
                      (tab) => (
                        <TabsTrigger
                          key={tab}
                          value={tab}
                          disabled={editingAny && tab !== activeTab}
                        >
                          {TAB_LABEL[tab]}
                        </TabsTrigger>
                      ),
                    )}
                  </TabsList>

                  {/* A Descrição é o "título" do lançamento (pedido do dono,
                      2026-09-29): o primeiro campo, logo abaixo das abas, igual
                      em todas elas — por isso fora de cada TabsContent. */}
                  <Field label="Descrição" required={false} className="mt-20">
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        value={description}
                        maxLength={200}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="O que foi, em poucas palavras (opcional)"
                      />
                    )}
                  </Field>
                  <TabsContent value="Expense" className="mt-20">
                    <ExpenseRevenueFields
                      kind="Expense"
                      value={expenseState}
                      onChange={setExpenseState}
                      categories={categoriesFor('Expense')}
                      blocks={blocks}
                      bankAccounts={allAccounts}
                      onCreateCategory={handleCreateCategory}
                      creatingCategory={createCategory.isPending}
                      errors={expenseErrors}
                      editingExisting={editing}
                      seriesSlot={seriesSlot}
                    />
                  </TabsContent>
                  <TabsContent value="Revenue" className="mt-20">
                    <ExpenseRevenueFields
                      kind="Revenue"
                      value={revenueState}
                      onChange={setRevenueState}
                      categories={categoriesFor('Revenue')}
                      blocks={blocks}
                      bankAccounts={allAccounts}
                      onCreateCategory={handleCreateCategory}
                      creatingCategory={createCategory.isPending}
                      errors={revenueErrors}
                      editingExisting={editing}
                      seriesSlot={seriesSlot}
                    />
                  </TabsContent>
                  <TabsContent value="ProLaboreEDistribuicao" className="mt-20">
                    <ProLaboreFields
                      value={proLaboreState}
                      onChange={setProLaboreState}
                      pjAccounts={pjAccounts}
                      pfAccounts={pfAccounts}
                      errors={proLaboreErrors}
                      editingExisting={editing}
                      seriesSlot={seriesSlot}
                    />
                  </TabsContent>
                  <TabsContent value="IncomeTax" className="mt-20">
                    <IncomeTaxFields
                      value={incomeTaxState}
                      onChange={setIncomeTaxState}
                      bankAccounts={allAccounts}
                      errors={incomeTaxErrors}
                      editingExisting={editing}
                      seriesSlot={seriesSlot}
                    />
                  </TabsContent>
                </Tabs>

                {submitError ? (
                  <p role="alert" className="text-style-body-sm text-ink-negative">
                    {submitError}
                  </p>
                ) : null}

                {/* Rodapé `877:1104`: dois botões da MESMA largura (210 + 12 de
                    gap + 210 = os 432 do conteúdo), e a legenda `877:1109` "*
                    Campo obrigatório" ABAIXO deles, alinhada à esquerda em
                    y=1106 — não ao lado. Não há divisor acima do rodapé: os
                    únicos do frame estão em y=514 e y=803 (`872:1386`,
                    `877:23`), entre as seções. */}
                <div className="flex flex-col gap-16">
                  {savedFlash ? (
                    <p role="status" className="text-style-body-sm text-ink-secondary">
                      Lançamento salvo com sucesso.
                    </p>
                  ) : null}
                  {/* "Salvar Lançamento" salva e fecha; com "Lançar outro em
                      seguida" ligado, salva e deixa o formulário limpo, aberto
                      (2026-10-01: uma opção no lugar do segundo botão). Na
                      edição, "Descartar" vem para a mesma linha, à vista. */}
                  {/* Origem no banco (dono, 2026-10-09): ligar um lançamento feito à
                      mão à transação do Open Finance, ou dizer que já está ligado. */}
                  {editing &&
                  existingEntry !== null &&
                  (existingEntry.kind === 'Expense' ||
                    existingEntry.kind === 'Revenue' ||
                    existingEntry.kind === 'IncomeTax') ? (
                    existingEntry.linkedToBank === true ? (
                      <p className="text-style-body-sm text-ink-secondary">
                        Vinculado a uma transação do banco.
                      </p>
                    ) : (
                      <div className="flex items-center justify-between gap-12">
                        <p className="text-style-body-sm text-ink-secondary">
                          Este lançamento ainda não tem origem no banco.
                        </p>
                        <LinkToBankButton
                          entryId={existingEntry.id}
                          entryName={entryDisplayName(existingEntry, categoriesById)}
                          // Valor e data mudaram para os do banco: o formulário
                          // aberto ficaria com os antigos.
                          onLinked={() => router.push(originHref(origin))}
                        />
                      </div>
                    )
                  ) : null}
                  <div className="flex items-center gap-12">
                    {editing && existingEntry !== null ? (
                      <DiscardEntryButton
                        entryId={existingEntry.id}
                        entryName={entryDisplayName(existingEntry, categoriesById)}
                        hasRecurrence={existingEntry.recurrenceId !== null}
                        size="default"
                        onDiscarded={() => router.push(originHref(origin))}
                      />
                    ) : null}
                    <Button variant="secondary" onClick={handleBack} className="flex-1">
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => void handleSubmit(!editingAny && launchAnother)}
                      disabled={saving}
                      className="flex-1"
                    >
                      {editingSeries ? 'Salvar' : 'Salvar Lançamento'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-12">
                    <RequiredFieldLegend />
                    {!editingAny ? (
                      <div className="flex items-center gap-8">
                        <label
                          htmlFor={launchAnotherId}
                          className="text-style-body-sm text-ink-secondary"
                        >
                          Lançar outro em seguida
                        </label>
                        <Switch
                          id={launchAnotherId}
                          checked={launchAnother}
                          onCheckedChange={setLaunchAnother}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.problem?.detail ?? 'Não foi possível salvar. Tente novamente.'
  }
  return 'Não foi possível salvar. Tente novamente.'
}

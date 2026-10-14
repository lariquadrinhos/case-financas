'use client'

import * as React from 'react'
import { OnboardingStepShell } from '@/components/patterns/onboarding-shell'
import { Loading, SKELETON_BARS } from '@/components/patterns/loading'
import { ErrorState, MutationError } from '@/components/patterns/error-state'
import { ItemRowActions } from '@/components/patterns/item-row-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { MoneyInput } from '@/components/patterns/money-input'
import { SegmentedControl } from '@/components/patterns/segmented-control'
import { ColourSwatchPicker } from '@/components/patterns/colour-swatch-picker'
import { bankAccounts } from '@/features/plano-de-contas-e-patrimonio/bank-accounts'
import type { BankAccount, NewBankAccount } from '@/features/plano-de-contas-e-patrimonio/types'
import { cents, formatMoney, ZERO, type Cents, type Entity } from '@/domain/core'
import type { BankAccountColour } from '@/domain/assets'
import {
  BANK_SUGGESTION_SWATCHES,
  DEFAULT_BANK_ACCOUNT_COLOUR,
  bankAccountSwatch,
} from '@/lib/bank-account-colours'

interface DraftBankAccount {
  label: string
  colour: BankAccountColour
  entity: Entity
  balance: Cents
}

function emptyDraft(): DraftBankAccount {
  return { label: '', colour: DEFAULT_BANK_ACCOUNT_COLOUR, entity: 'PF', balance: ZERO }
}

/**
 * Onboarding 2 — Contas Bancárias. files_design/01 §3.2, Figma 29:39.
 * "Legenda/cor" is two fields (files_design/02): `label` the person types,
 * `colour` a swatch — the bug log (files_design/02, "campo Cor nunca existiu")
 * is exactly why both are here, not just the name.
 */
export default function ContasBancariasPage() {
  const list = bankAccounts.useList()
  const create = bankAccounts.useCreate()
  const items = list.data?.data ?? []

  return (
    <OnboardingStepShell
      step={2}
      stepLabel="Contas Bancárias"
      title="Cadastre suas contas bancárias e patrimônio"
      description={<p>Legenda/cor, entidade e saldo atual. Adicione quantas contas quiser.</p>}
      requiredLegend
    >
      {list.isLoading ? (
        <Loading label="Carregando contas bancárias" bars={SKELETON_BARS.CONTAS_BANCARIAS} />
      ) : list.isError ? (
        <ErrorState
          message="Não foi possível carregar suas contas. Verifique sua conexão e tente de novo."
          onRetry={() => void list.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {items.map((item) => (
            <BankAccountRow key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        <p className="text-style-body-md font-medium text-ink-primary">Adicionar conta</p>
        <BankAccountForm
          submitLabel="+ Adicionar"
          pending={create.isPending}
          error={create.error}
          onSubmit={(draft, { reset }) => {
            const body: NewBankAccount = {
              label: draft.label,
              colour: draft.colour,
              entity: draft.entity,
              balance: draft.balance,
            }
            create.mutate(body, { onSuccess: reset })
          }}
        />
      </div>
    </OnboardingStepShell>
  )
}

function BankAccountRow({ item }: { item: BankAccount }) {
  const [editing, setEditing] = React.useState(false)
  const patch = bankAccounts.usePatch()
  const remove = bankAccounts.useRemove()

  if (editing) {
    return (
      <div className="rounded-control border border-line-default p-16">
        <BankAccountForm
          initial={{
            label: item.label,
            colour: item.colour,
            entity: item.entity,
            balance: cents(item.balance),
          }}
          submitLabel="Salvar"
          pending={patch.isPending}
          error={patch.error}
          onCancel={() => setEditing(false)}
          onSubmit={(draft) => {
            patch.mutate({ id: item.id, body: draft }, { onSuccess: () => setEditing(false) })
          }}
        />
      </div>
    )
  }

  const swatch = bankAccountSwatch(item.colour)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-16 rounded-control bg-surface-subtle px-16 py-12">
        <div className="flex flex-1 items-center gap-12">
          <span
            aria-hidden="true"
            className="h-[var(--space-16)] w-[var(--space-16)] shrink-0 rounded-pill"
            style={{ backgroundColor: `var(${swatch.cssVariable})` }}
          />
          <span className="text-style-body-md text-ink-primary">{item.label}</span>
          <span className="text-style-body-md text-ink-secondary">{item.entity}</span>
          <span className="ml-auto text-style-numeric-md text-ink-primary">
            {formatMoney(cents(item.balance))}
          </span>
        </div>
        <ItemRowActions onEdit={() => setEditing(true)} onDiscard={() => remove.mutate(item.id)} />
      </div>
      {/* `DELETE` answers 409 when the record is already referenced
          (`bank_accounts.in_use`, `liabilities.in_use`, `investments.in_use`).
          Without this the row just stays put and "Descartar" looks broken. */}
      <MutationError error={remove.error} />
    </div>
  )
}

function BankAccountForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: DraftBankAccount
  submitLabel: string
  pending: boolean
  /** The failed create/patch this form triggered, if any — surfaced in place. */
  error?: unknown
  onSubmit: (draft: DraftBankAccount, helpers: { reset: () => void }) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = React.useState<DraftBankAccount>(initial ?? emptyDraft())

  function reset() {
    setDraft(emptyDraft())
  }

  const canSubmit = draft.label.trim() !== '' && !pending

  return (
    /* Mockup `1111:23` (Onboarding 2, claro) e o gêmeo `921:35`: os quatro
     * campos começam todos em y=0 — Campo `921:36` (h=64), Cor `921:40`
     * (h=54), Entidade `921:55` (h=64), Campo `921:56` (h=64). Alinhamento
     * pelo TOPO, com "Cor" mais baixo que os vizinhos; `items-end` alinhava o
     * rodapé e empurrava a fila de círculos ~10px abaixo de y=26. O gap de 16
     * é o mesmo do frame (x=336.5→352.5 e 687.5→703.5). */
    <div className="flex flex-wrap items-start gap-16">
      <Field label="Nome da conta" className="w-[var(--width-field-name-account)]">
        {(props) => (
          <Input
            {...props}
            placeholder="Ex: Nubank"
            value={draft.label}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
        )}
      </Field>

      {/* A fila de cores está desenhada, com geometria fechada, em Mockup
       * `1111:8`/`1111:10` (Onboarding 2, claro) e `921:40`/`921:42` (Contas
       * Bancárias, claro), e no Wireframe em `36:2`/`36:4` (dentro de
       * `29:39`) e `332:115`/`332:117` (dentro de `332:2`): 6 elipses de
       * 28×28 em x=0/40/80/120/160/200, container de 228px de largura. São
       * seis opções fixas e mutuamente exclusivas com uma sempre marcada
       * (files_design/03, exceção 3) — daí radio group, não seis toggles. O
       * controle é local à tela porque o Style guide `383:2` não tem
       * componente para isto: o Controle segmentado diz "QUANDO NÃO USAR:
       * mais de 3 opções (vira lista/dropdown)". */}
      <Field label="Cor" required={false}>
        {(props) => (
          <ColourSwatchPicker
            {...props}
            aria-label="Cor"
            swatches={BANK_SUGGESTION_SWATCHES}
            value={draft.colour}
            onValueChange={(colour) => setDraft({ ...draft, colour })}
          />
        )}
      </Field>

      <Field label="Entidade" required={false}>
        {(props) => (
          <SegmentedControl
            {...props}
            aria-label="Entidade"
            value={draft.entity}
            onValueChange={(entity) => setDraft({ ...draft, entity })}
            options={[
              { value: 'PF', label: 'PF' },
              { value: 'PJ', label: 'PJ' },
            ]}
          />
        )}
      </Field>

      <Field label="Saldo" className="w-[var(--width-field-money-account)]">
        {(props) => (
          <MoneyInput
            {...props}
            value={draft.balance}
            onValueChange={(balance) => setDraft({ ...draft, balance })}
          />
        )}
      </Field>

      <MutationError error={error} />

      <div className="ml-auto flex items-center gap-8">
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button variant="primary" disabled={!canSubmit} onClick={() => onSubmit(draft, { reset })}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

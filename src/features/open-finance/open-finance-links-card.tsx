'use client'

/**
 * "Open Finance" — onde a pessoa vincula cada conta que o banco informa a um
 * cadastro do Bigorna (ADR-0020 §3, PRD P50).
 *
 * NÃO ESTÁ NO FIGMA (🟩 pendente em files_design/01 §10). Redesenhado em
 * 2026-09-29 depois do primeiro uso real, que mostrou três defeitos da versão em
 * tabela: três controles por linha (seletor, PF/PJ e "Criar e vincular") com o
 * "Desvincular" solto embaixo, dobrando a altura; dezenas de contas zeradas sem
 * vínculo no meio das que importam; e nenhuma pista de qual banco era cada
 * conta, nem de quando foi a última sincronização.
 *
 * Agora: agrupado por banco, uma linha compacta por conta e UM controle — o
 * seletor "Vincular a…", que carrega também "Criar nova (PF/PJ)" e
 * "Desvincular". As sem vínculo e com saldo zero ficam recolhidas.
 */

import * as React from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select'
import { ErrorState } from '@/components/patterns/error-state'
import { Loading } from '@/components/patterns/loading'
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons'
import { cents, formatDate, formatMoney, isoDate } from '@/domain/core'
import { ApiError } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import {
  useCreatePositionFromBank,
  useLinkOpenFinanceAccount,
  useOpenFinanceAccountMovements,
  useOpenFinanceAccounts,
  useOpenFinanceSyncStatus,
  useReimportOpenFinance,
  useSetOpenFinanceAutoSync,
  useSyncOpenFinance,
  type OpenFinanceAccount,
  type OpenFinanceAccountKind,
  type OpenFinanceLinkTarget,
} from './use-open-finance'

/** Radix Select não aceita valor vazio: estes são os itens de ação. */
const UNLINKED = '__nao-vinculada__'
const CREATE_PF = '__criar-pf__'
const CREATE_PJ = '__criar-pj__'

const KIND_LABEL: Record<OpenFinanceAccountKind, string> = {
  Checking: 'Conta corrente',
  CreditCard: 'Cartão de crédito',
  Investment: 'Investimento',
}

const CREATE_LABEL: Record<OpenFinanceAccountKind, string> = {
  Checking: 'Criar conta nova',
  CreditCard: '',
  Investment: 'Criar investimento novo',
}

const OTHER_BANK = 'Outro banco'

/** O que cada movimento virou no Bigorna — em palavras do produto (files_design/04). */
const OUTCOME_LABEL: Record<string, string> = {
  DiscretionaryExpense: 'Consumo Livre',
  PayPlanned: 'Pagou um Previsto',
  Transfer: 'Transferência',
  CardPurchase: 'Compra no cartão',
  CardBillPayment: 'Pagamento de fatura',
  Entry: 'Lançamento',
  Ignored: 'Fora do DRE',
}

export interface LinkOption {
  readonly id: string
  readonly label: string
}

interface Props {
  /** Quais contas do banco este card mostra. */
  readonly kinds: readonly OpenFinanceAccountKind[]
  /** Os cadastros do Bigorna a que elas podem apontar. */
  readonly options: readonly LinkOption[]
}

function targetFor(kind: OpenFinanceAccountKind, id: string): OpenFinanceLinkTarget {
  switch (kind) {
    case 'Checking':
      return { kind: 'BankAccount', bankAccountId: id }
    case 'CreditCard':
      return { kind: 'CreditCard', paidByBankAccountId: id }
    case 'Investment':
      return { kind: 'Investment', investmentId: id }
  }
}

function linkedIdOf(account: OpenFinanceAccount): string {
  const target = account.link?.target
  if (target === undefined) return UNLINKED
  switch (target.kind) {
    case 'BankAccount':
      return target.bankAccountId
    case 'CreditCard':
      return target.paidByBankAccountId
    case 'Investment':
      return target.investmentId
  }
}

/** "hoje, 18:05" · "ontem, 09:12" · "27/09, 14:00". Hora local (P29). */
function formatSyncedAt(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === now.toDateString()) return `hoje, ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `ontem, ${time}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`
}

function syncResultText(result: ReturnType<typeof useSyncOpenFinance>['data']): string | null {
  if (result === undefined) return null
  if (result.status === 'Skipped') return 'Já estava sincronizado.'
  if (result.status === 'Paused') return null
  const total = Object.entries(result.imported)
    .filter(([kind]) => kind !== 'Ignored')
    .reduce((sum, [, n]) => sum + n, 0)
  return total === 0 ? 'Nada novo no banco.' : `${total} novidade(s) importada(s).`
}

/**
 * "Sincronizar ao abrir o app" (pedido do dono, 2026-10-01: "quero ter a
 * opção de remover a sincronização"). Desligado, o app para de ler o banco
 * sozinho; "Sincronizar agora", o que já foi importado e os vínculos ficam.
 * NÃO ESTÁ NO FIGMA, como o card inteiro (files_design/01 §10): segue o par
 * rótulo + Switch de "Encerrar a recorrência também".
 */
function AutoSyncToggle() {
  const status = useOpenFinanceSyncStatus()
  const setAutoSync = useSetOpenFinanceAutoSync()
  const id = React.useId()
  const checked = setAutoSync.isPending ? setAutoSync.variables : (status.data?.autoSync ?? true)
  return (
    <div className="flex items-center gap-8">
      <label htmlFor={id} className="text-style-body-sm text-ink-secondary">
        Sincronizar ao abrir o app
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={status.isLoading || setAutoSync.isPending}
        onCheckedChange={(next) => setAutoSync.mutate(next)}
      />
    </div>
  )
}

/** Agrupa por banco, em ordem alfabética, com "Outro banco" por último. */
function groupByInstitution(accounts: readonly OpenFinanceAccount[]) {
  const groups = new Map<string, OpenFinanceAccount[]>()
  for (const account of accounts) {
    const key = account.institution ?? OTHER_BANK
    groups.set(key, [...(groups.get(key) ?? []), account])
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === OTHER_BANK) return 1
    if (b === OTHER_BANK) return -1
    return a.localeCompare(b, 'pt-BR')
  })
}

export function OpenFinanceLinksCard({ kinds, options }: Props) {
  const accounts = useOpenFinanceAccounts()
  const status = useOpenFinanceSyncStatus()
  const sync = useSyncOpenFinance()
  const [showIdle, setShowIdle] = React.useState(false)
  const notConfigured =
    accounts.error instanceof ApiError &&
    accounts.error.problem?.code === 'open_finance.not_configured'

  const ofKind = (accounts.data?.data ?? []).filter((a) => kinds.includes(a.kind))
  // Sem vínculo e zerada: quase sempre um produto que o banco abre sozinho
  // (caixinha, conta pré-paga). Recolhida para não esconder o que importa.
  const isIdle = (a: OpenFinanceAccount) => a.link === null && a.balance === 0
  const idleCount = ofKind.filter(isIdle).length
  const visible = showIdle ? ofKind : ofKind.filter((a) => !isIdle(a))
  const lastSyncedAt = status.data?.lastSyncedAt ?? null
  const result = sync.isSuccess ? syncResultText(sync.data) : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-16">
          <div className="flex flex-col gap-4">
            <CardTitle>Open Finance</CardTitle>
            {!notConfigured ? (
              <p role="status" className="text-style-body-sm text-ink-secondary">
                {lastSyncedAt === null
                  ? 'Ainda não sincronizado.'
                  : `Sincronizado ${formatSyncedAt(lastSyncedAt)}.`}
                {result !== null ? ` ${result}` : null}
              </p>
            ) : null}
          </div>
          {!notConfigured && !accounts.isError ? (
            <div className="flex items-center gap-8">
              <AutoSyncToggle />
              <ReimportButton />
              <Button
                variant="secondary"
                disabled={sync.isPending}
                onClick={() => sync.mutate(true)}
              >
                {sync.isPending ? 'Sincronizando…' : 'Sincronizar agora'}
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>
        {accounts.isLoading ? (
          <Loading label="Carregando contas do Open Finance" />
        ) : notConfigured ? (
          <p className="text-style-body-sm text-ink-secondary">
            O Open Finance não está configurado nesta instalação. Conecte seus bancos no Meu Pluggy
            e informe PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS no .env.
          </p>
        ) : accounts.isError ? (
          <ErrorState
            message="Não foi possível ler o Open Finance agora. Os dados da última sincronização continuam valendo."
            onRetry={() => void accounts.refetch()}
          />
        ) : ofKind.length === 0 ? (
          <p className="text-style-body-sm text-ink-secondary">
            Nenhuma conta deste tipo chegou do Open Finance.
          </p>
        ) : (
          <div className="flex flex-col gap-16">
            <p className="text-style-body-sm text-ink-secondary">
              Numa conta vinculada, o saldo e o que é pago chegam pelo banco.
            </p>
            {sync.isError ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {sync.error instanceof ApiError
                  ? sync.error.message
                  : 'Não foi possível sincronizar.'}
              </p>
            ) : null}
            {groupByInstitution(visible).map(([institution, items]) => (
              <section key={institution} aria-label={institution} className="flex flex-col">
                <h3 className="pb-8 text-style-label-xs text-ink-secondary">{institution}</h3>
                {items.map((account) => (
                  <LinkRow key={account.id} account={account} options={options} />
                ))}
              </section>
            ))}
            {idleCount > 0 ? (
              <Button
                variant="text"
                className="self-start"
                onClick={() => setShowIdle((shown) => !shown)}
              >
                {showIdle
                  ? 'Ocultar contas zeradas sem vínculo'
                  : `Mostrar ${idleCount} conta(s) zerada(s) sem vínculo`}
              </Button>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function LinkRow({
  account,
  options,
}: {
  account: OpenFinanceAccount
  options: readonly LinkOption[]
}) {
  const link = useLinkOpenFinanceAccount()
  const create = useCreatePositionFromBank()
  const pending = link.isPending || create.isPending
  const failure = link.error ?? create.error
  const isCard = account.kind === 'CreditCard'
  const linked = account.link !== null
  const [expanded, setExpanded] = React.useState(false)

  function handleChange(value: string) {
    if (value === CREATE_PF || value === CREATE_PJ) {
      create.mutate({ id: account.id, entity: value === CREATE_PF ? 'PF' : 'PJ' })
      return
    }
    link.mutate({
      id: account.id,
      target: value === UNLINKED ? null : targetFor(account.kind, value),
    })
  }

  return (
    <Collapsible.Root
      open={expanded}
      onOpenChange={setExpanded}
      className="flex flex-col gap-4 border-t border-line-default py-12"
    >
      <div className="flex items-center gap-16">
        {/* Expandir mostra os movimentos do mês (pedido do dono, 2026-09-29):
            é como a pessoa reconhece qual conta é qual antes de vincular. */}
        <Collapsible.Trigger
          className={cn(
            'flex min-w-0 flex-1 items-center gap-8 rounded-control text-left outline-none',
            'hover:bg-surface-hover',
            'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
          )}
        >
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-style-body-md text-ink-primary">
              {KIND_LABEL[account.kind]}
              {account.numberSuffix !== null ? ` · final ${account.numberSuffix}` : null}
            </span>
            <span className="truncate text-style-body-sm text-ink-secondary" title={account.name}>
              {account.name}
            </span>
          </span>
        </Collapsible.Trigger>
        <span className="shrink-0 text-right text-style-numeric-md text-ink-primary">
          {formatMoney(cents(account.balance))}
        </span>
        <div className="w-[var(--width-open-finance-link)] shrink-0">
          <Select value={linkedIdOf(account)} disabled={pending} onValueChange={handleChange}>
            <SelectTrigger
              aria-label={`Vínculo de ${KIND_LABEL[account.kind]}${
                account.numberSuffix !== null ? ` final ${account.numberSuffix}` : ''
              }`}
              className={cn(!linked && 'text-ink-secondary')}
            />
            <SelectContent>
              {!linked ? (
                <SelectItem value={UNLINKED}>{pending ? 'Salvando…' : 'Vincular a…'}</SelectItem>
              ) : null}
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {isCard ? `Paga por ${option.label}` : option.label}
                </SelectItem>
              ))}
              {!isCard || linked ? <SelectSeparator /> : null}
              {!isCard ? (
                <>
                  <SelectItem value={CREATE_PF}>+ {CREATE_LABEL[account.kind]} (PF)</SelectItem>
                  <SelectItem value={CREATE_PJ}>+ {CREATE_LABEL[account.kind]} (PJ)</SelectItem>
                </>
              ) : null}
              {linked ? <SelectItem value={UNLINKED}>Desvincular</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
      </div>
      {failure ? (
        <p role="alert" className="text-right text-style-body-sm text-ink-negative">
          {failure instanceof ApiError ? failure.message : 'Não foi possível vincular.'}
        </p>
      ) : null}
      <Collapsible.Content>
        <Movements accountId={account.id} enabled={expanded} />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

function Movements({ accountId, enabled }: { accountId: string; enabled: boolean }) {
  const movements = useOpenFinanceAccountMovements(accountId, enabled)
  if (movements.isLoading) return <Loading label="Carregando movimentos" />
  if (movements.isError) {
    return (
      <p role="alert" className="text-style-body-sm text-ink-negative">
        Não foi possível ler os movimentos agora.
      </p>
    )
  }
  const items = movements.data?.data ?? []
  if (items.length === 0) {
    return <p className="text-style-body-sm text-ink-secondary">Nenhum movimento neste mês.</p>
  }
  return (
    <ul
      aria-label="Movimentos do mês"
      className="flex flex-col rounded-control bg-surface-subtle px-12 py-4"
    >
      {items.map((m) => (
        <li key={m.id} className="flex items-center gap-16 py-8">
          <span className="w-[var(--width-event-date)] shrink-0 text-style-body-sm text-ink-secondary">
            {formatDate(isoDate(m.date))}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-style-body-sm text-ink-primary" title={m.description}>
              {m.description}
            </span>
            {m.providerCategory !== null ? (
              <span className="truncate text-style-label-xs text-ink-secondary">
                {m.providerCategory}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-style-body-sm text-ink-secondary">
            {m.outcome === null ? 'Não importado' : (OUTCOME_LABEL[m.outcome] ?? m.outcome)}
          </span>
          <span className="w-[var(--width-field-money-dialog)] shrink-0 text-right text-style-numeric-md text-ink-primary">
            {m.direction === 'Out' ? '−' : '+'}
            {formatMoney(cents(m.amount))}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * "Reimportar" — desfaz o que a importação criou e importa de novo com as
 * regras e a configuração de agora (src/api/open-finance.ts `undoImport`).
 * Pede confirmação porque apaga edições feitas à mão em lançamentos importados.
 */
function ReimportButton() {
  const reimport = useReimportOpenFinance()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Reimportar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent width="form">
          <DialogHeader>
            <DialogTitle>Reimportar do Open Finance?</DialogTitle>
            <DialogDescription>
              Os lançamentos que vieram do banco são refeitos com a configuração de agora: Consumo
              Livre, vínculos e categorias. Edições feitas à mão nesses lançamentos se perdem.
              Previstos que o banco já pagou continuam como estão.
            </DialogDescription>
          </DialogHeader>
          {reimport.isError ? (
            <DialogBody>
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {reimport.error instanceof ApiError
                  ? reimport.error.message
                  : 'Não foi possível reimportar. Nada foi desfeito.'}
              </p>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={reimport.isPending}
              onClick={() => reimport.mutate(undefined, { onSuccess: () => setOpen(false) })}
            >
              {reimport.isPending ? 'Reimportando…' : 'Reimportar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

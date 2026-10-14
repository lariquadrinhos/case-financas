'use client'

/**
 * Os lançamentos de UMA categoria do DRE, com a descrição real do banco — o que
 * se vê ao abrir, por exemplo, "Outras receitas operacionais" dentro de
 * "Receita Bruta" (pedido do dono, 2026-09-29: "quero a descrição de fato do
 * que é").
 *
 * E é aqui que a pessoa categoriza (PRD v7.46, "sem de-para"): num lançamento
 * que veio do banco, o seletor troca a categoria na hora, e o "Reimportar"
 * passa a preservar essa escolha. Um lançamento feito à mão não tem descrição
 * do banco; ele se edita pelo "Editar" da tabela "Lançamentos deste mês".
 *
 * NÃO ESTÁ NO FIGMA: o DRE desenha a cascata com as categorias (v7.39), mas não
 * um terceiro nível. Segue a tipografia da linha de categoria que já existe.
 */

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { categoriesForKind } from '@/domain/chart-of-accounts'
import { cents, formatDate, formatMoney, isoDate } from '@/domain/core'
import { apiGet, apiPatch, ApiError } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { HideToggle } from '@/components/patterns/hide-toggle'
import { RecurringMark } from '@/components/patterns/recurring-mark'
import { CreditCardMark } from '@/components/patterns/credit-card-mark'
import type { ListEnvelope } from '@/api/http'
import {
  categories,
  useStatementBlocks,
} from '@/features/plano-de-contas-e-patrimonio/chart-of-accounts'

interface EntryOrigin {
  readonly entryId: string
  readonly kind: string
  readonly date: string
  readonly description: string
  readonly providerCategory: string | null
}

export function useEntryOrigins(month: string) {
  return useQuery({
    queryKey: ['open-finance', 'entry-origins', month] as const,
    queryFn: () => apiGet<ListEnvelope<EntryOrigin>>('/open-finance/entry-origins', { month }),
    // Sem Open Finance a lista só vem vazia; nada a repetir.
    retry: false,
  })
}

/** O mínimo de um lançamento que a lista precisa — o DRE e a Pendência montam isto. */
export interface CategorizableItem {
  /** `null` para o que não é Lançamento (parcela de Passivo). */
  readonly entryId: string | null
  readonly name: string
  /** A Descrição do lançamento, quando a pessoa escreveu uma. */
  readonly description?: string | null
  /**
   * A data do lançamento. Antes só a do banco aparecia, e todo lançamento feito
   * à mão — recorrente inclusive — saía com "—" (captura do dono, 2026-10-06).
   */
  readonly date?: string
  /** De uma série (Recorrência): mostra a marca "Recorrente". */
  readonly recurring?: boolean
  /** "Cartão de crédito" (ADR-0021): mostra a marca de cartão. */
  readonly isCreditCard?: boolean
  readonly categoryId: string | null
  readonly amount: number
  /** Simulação do DRE (2026-10-01): o token de `hidden=` desta linha, e se está oculta. */
  readonly hideToken?: string
  readonly hidden?: boolean
}

export function DreCategoryEntries({
  month,
  items,
  onToggleHidden,
  editHref,
}: {
  month: string
  items: readonly CategorizableItem[]
  /**
   * No DRE, a categoria se troca pelo "Editar" do lançamento, não por um
   * seletor na linha (dono, 2026-10-06: "melhor a pessoa editar para escolher,
   * ao invés de mostrar aqui"). Ausente no "Categorizar agora", cujo propósito
   * é justamente escolher ali.
   */
  editHref?: (entryId: string) => string
  /**
   * O "olhinho" do DRE em cada lançamento, na ponta direita da linha (pedido
   * do dono, 2026-10-01). Ausente na Pendência "Categorizar agora", que não
   * simula nada.
   */
  onToggleHidden?: (token: string) => void
}) {
  const origins = useEntryOrigins(month)
  const originOf = new Map((origins.data?.data ?? []).map((o) => [o.entryId, o]))

  // Do mais recente ao mais antigo, pela data do banco quando há uma e pela do
  // lançamento quando não; o que não tem data nenhuma (parcela) no fim.
  const dateOf = (item: CategorizableItem) =>
    (item.entryId === null ? undefined : originOf.get(item.entryId)?.date) ?? item.date ?? ''
  const ordered = [...items].sort((a, b) => {
    const da = dateOf(a)
    const db = dateOf(b)
    return da < db ? 1 : da > db ? -1 : 0
  })

  if (ordered.length === 0) {
    return <p className="text-style-body-sm text-ink-secondary">Nenhum lançamento.</p>
  }

  return (
    // `contain: inline-size` (captura do dono, 2026-10-06): a descrição é
    // `truncate`, e numa tabela automática o texto inteiro vira a largura
    // mínima da célula. Medido no DRE de outubro: a cascata saía com 1126px
    // num card que oferece 1046px, e os valores passavam 59px da borda. Com a
    // contenção, 1046px — a descrição corta com reticências.
    <ul aria-label="Lançamentos da categoria" className="flex flex-col [contain:inline-size]">
      {ordered.map((row) => {
        const entryId = row.entryId
        const origin = entryId === null ? undefined : originOf.get(entryId)
        const date = dateOf(row)
        return (
          <li
            key={entryId ?? `${row.name}-${row.amount}`}
            className={cn(
              'flex items-center gap-16 border-t border-line-default py-8',
              row.hidden === true &&
                '[&>*:not(:last-child)]:line-through [&>*:not(:last-child)]:opacity-40',
            )}
          >
            <span className="w-[var(--width-event-date)] shrink-0 text-style-body-sm text-ink-secondary">
              {date ? formatDate(isoDate(date)) : '—'}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-8">
                <span
                  className="truncate text-style-body-sm text-ink-primary"
                  title={origin?.description}
                >
                  {origin
                    ? origin.description
                    : row.description
                      ? `${row.description} · lançado à mão`
                      : `${row.name} · lançado à mão`}
                </span>
                {row.recurring ? <RecurringMark /> : null}
                {row.isCreditCard ? <CreditCardMark /> : null}
              </span>
              {origin?.providerCategory ? (
                <span className="truncate text-style-label-xs text-ink-secondary">
                  No banco: {origin.providerCategory}
                </span>
              ) : null}
            </span>
            {editHref && entryId !== null ? (
              <Button asChild variant="secondary" size="compact">
                <Link href={editHref(entryId)}>Editar</Link>
              </Button>
            ) : origin && entryId !== null && row.categoryId !== null ? (
              <CategorySelect
                entryId={entryId}
                kind={origin.kind}
                categoryId={row.categoryId}
                description={origin.description}
              />
            ) : null}
            <span className="w-[var(--width-field-money-dialog)] shrink-0 text-right text-style-numeric-md text-ink-secondary">
              {formatMoney(cents(row.amount))}
            </span>
            {/* Na ponta direita, depois do valor (escolha do dono, 2026-10-01). */}
            {onToggleHidden && row.hideToken ? (
              <HideToggle
                hidden={row.hidden === true}
                onToggle={() => onToggleHidden(row.hideToken!)}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function CategorySelect({
  entryId,
  kind,
  categoryId,
  description,
}: {
  entryId: string
  kind: string
  categoryId: string
  description: string
}) {
  const client = useQueryClient()
  const list = categories.useList()
  const blocks = useStatementBlocks()
  const change = useMutation({
    mutationFn: (next: string) =>
      apiPatch(`/entries/${encodeURIComponent(entryId)}`, { kind, categoryId: next }),
    onSuccess: () => client.invalidateQueries(),
  })
  const blockName = new Map((blocks.data?.data ?? []).map((b) => [b.id, b.name]))
  // Uma despesa vinda do banco escolhe só o TIPO de despesa: categorias dos
  // blocos que subtraem (pedido do dono, 2026-10-01). Medido no plano de contas
  // real: `categoriesForKind` ainda oferecia os blocos de efeito Signed
  // (Resultado Financeiro, Não Operacional — "Rendimento de caixa/conta"
  // entre eles) e a Destinação do Lucro ("Reserva em caixa"), que aceitam
  // despesa mas não são tipo de despesa. Receita segue `categoriesForKind`:
  // rendimento de conta é receita que o banco manda e mora no Signed.
  const usable = (list.data?.data ?? []).filter(
    (c) => !c.archived && (!c.isSystem || c.id === categoryId),
  )
  const effectOf = new Map((blocks.data?.data ?? []).map((b) => [b.id, b.effect]))
  const options =
    kind === 'Expense'
      ? usable.filter((c) => effectOf.get(c.blockId) === 'Subtract' || c.id === categoryId)
      : kind === 'Revenue'
        ? categoriesForKind(usable, blocks.data?.data ?? [], kind)
        : usable

  return (
    <div className="flex w-[var(--width-open-finance-link)] shrink-0 flex-col gap-4">
      <Select
        value={categoryId}
        disabled={change.isPending}
        onValueChange={(v) => change.mutate(v)}
      >
        <SelectTrigger aria-label={`Categoria de ${description}`} />
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
              {blockName.has(c.blockId) ? ` · ${blockName.get(c.blockId)}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {change.isError ? (
        <p role="alert" className="text-style-body-sm text-ink-negative">
          {change.error instanceof ApiError ? change.error.message : 'Não foi possível trocar.'}
        </p>
      ) : null}
    </div>
  )
}

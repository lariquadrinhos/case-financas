/**
 * Wire types for Novo Lançamento (4 abas) — inferred straight from the Zod
 * schemas in `src/api/contracts/*` (CLAUDE.md: "leia o contrato do recurso
 * antes de escrever a tela que o consome"). Inferring rather than hand-writing
 * a second copy is what keeps the screen from drifting the first time a field
 * is added to a contract.
 */

import type { z } from 'zod'
import type {
  entrySchema,
  entryPatchSchema,
  newEntrySchema,
  entryRecurrenceSchema,
  markAsPaidResultSchema,
} from '@/api/contracts/entries'
import type { bankAccountSchema } from '@/api/contracts/bank-accounts'
import type {
  categorySchema,
  newCategorySchema,
  statementBlockSchema,
} from '@/api/contracts/chart-of-accounts'

export type Entry = z.infer<typeof entrySchema>
/**
 * O corpo que o cliente ENVIA: `z.input`, com os padrões ainda opcionais — o
 * servidor os aplica. Com `z.infer` (a saída), cada campo novo com padrão
 * obrigava todo chamador a repeti-lo (2026-10-09, "Cartão de crédito" na receita).
 */
export type NewEntry = z.input<typeof newEntrySchema>
export type EntryPatch = z.infer<typeof entryPatchSchema>
export type EntryRecurrence = z.infer<typeof entryRecurrenceSchema>
export type MarkAsPaidResult = z.infer<typeof markAsPaidResultSchema>

export type BankAccount = z.infer<typeof bankAccountSchema>
export type Category = z.infer<typeof categorySchema>
export type NewCategory = z.infer<typeof newCategorySchema>
export type StatementBlock = z.infer<typeof statementBlockSchema>

/**
 * The four tabs, in the order files_design/01 §5 gives — by frequency, not
 * alphabet. `ProLaboreEDistribuicao` is its own tab id, distinct from the two
 * `Entry['kind']` it can produce (`ProLabore` | `ProfitDistribution`, picked by
 * the tab's own "Sub-tipo" field) — the tab and the kind are not 1:1.
 */
export const NOVO_LANCAMENTO_TABS = [
  'Expense',
  'Revenue',
  'ProLaboreEDistribuicao',
  'IncomeTax',
] as const
export type NovoLancamentoTab = (typeof NOVO_LANCAMENTO_TABS)[number]

/** Where the person came from — decides what "Voltar" (files_design/01 §5.5) does. */
// Toda tela do app (2026-10-01): o "+ Novo Lançamento" da barra lateral e o
// "Editar" das tabelas abriam o formulário e, ao salvar ou cancelar, a pessoa
// caía no Início em vez de voltar para onde estava. Uma lista fechada, e não
// "qualquer caminho": o valor vira um `router.push`.
export const NOVO_LANCAMENTO_ORIGINS = [
  'inicio',
  'historico',
  'dre',
  'balanco-patrimonial',
  'evolucao-mensal',
  'indicadores-financeiros',
  'revisao-de-recorrentes',
  'plano-de-contas',
  'contas-bancarias',
  'bens-materiais',
  'investimentos',
  'passivos',
] as const
export type NovoLancamentoOrigin = (typeof NOVO_LANCAMENTO_ORIGINS)[number]

export function isNovoLancamentoOrigin(value: string | null): value is NovoLancamentoOrigin {
  return (NOVO_LANCAMENTO_ORIGINS as readonly string[]).includes(value ?? '')
}

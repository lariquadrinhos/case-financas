/**
 * Contas Bancárias — `/api/v1/bank-accounts`.
 *
 * Fields from files_design/03 "Onboarding — Contas Bancárias". The PRD's single
 * "Legenda/cor" is two fields by design decision (files_design/02): the name the
 * person types and the swatch.
 *
 * `balance` is kept BY THE PERSON, not derived from the entries (PRD §1) — which
 * is why it is a writable field and not a computed one.
 */

import { BANK_ACCOUNT_COLOURS } from '@/domain/assets'
import { registry, z } from '@/api/registry'
import {
  centsSchema,
  entityWithDefault,
  entitySchema,
  idSchema,
  registerResource,
  shortTextSchema,
} from './common'

/**
 * A slug from the account palette, never a hex: colour is presentation and the
 * hex lives in `src/styles/tokens.css` (ADR-0011).
 *
 * The list is CLOSED — the six rows of Figma, page **Tokens**, node `1091:2`
 * "Cores de banco (referência)", mirrored by `BANK_ACCOUNT_COLOURS`
 * (src/domain/assets/types.ts) so there is a single list. It used to be
 * `z.string().regex(/^[a-z0-9-]{1,40}$/)`, sob uma pergunta em aberto (P16)
 * que alegava não existir fonte para a lista fechada de nomes — alegação
 * simplesmente falsa; o custo medido foi `POST /api/v1/bank-accounts` com
 * `colour: "conta-roxa"` answered **201** and the screen painted the dot grey
 * (the `bankAccountSwatch` fallback), instead of 422.
 */
export const bankAccountColourSchema = z.enum(BANK_ACCOUNT_COLOURS).openapi({
  description: 'Slug da cor da conta, da paleta fechada do Figma Tokens `1091:2`.',
  example: 'nubank',
})

export const bankAccountSchema = registry.register(
  'BankAccount',
  z.object({
    id: idSchema,
    label: z.string(),
    colour: bankAccountColourSchema,
    entity: entitySchema,
    balance: centsSchema,
  }),
)

export const newBankAccountSchema = registry.register(
  'NewBankAccount',
  z.strictObject({
    label: shortTextSchema,
    /** Exception 3: a "Cor" selector always has one swatch selected (files_design/01 §5.6). */
    colour: bankAccountColourSchema,
    entity: entityWithDefault,
    balance: centsSchema,
  }),
)

export const bankAccountPatchSchema = registry.register(
  'BankAccountPatch',
  newBankAccountSchema.partial(),
)

export const bankAccountQuerySchema = z.strictObject({
  entity: entitySchema.optional(),
})

registerResource({
  tag: 'Bank accounts',
  resource: 'bank-accounts',
  singular: 'conta bancária',
  item: bankAccountSchema,
  create: newBankAccountSchema,
  patch: bankAccountPatchSchema,
  query: bankAccountQuerySchema,
  // Deletable: an account with no entry pointing at it is a cadastro mistake.
  // The FK is RESTRICT, so an account already used answers 409, not 204.
  deletable: true,
})

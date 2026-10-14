/**
 * The "Cor" swatch palette of Contas Bancárias.
 *
 * The closed list is NOT defined here — it is written, in order, in the Figma
 * page **Tokens**, node `1091:2` "Cores de banco (referência)": one row per
 * colour (`1091:5055` Nubank · `1091:5061` Itaú · `1091:5067` Banco do Brasil ·
 * `1091:5073` Bradesco · `1091:5079` Caixa · `1091:5085` "Cor extra") with
 * swatch, name, hex, rgb and source. The same table is transcribed in
 * files_design/07 §"Cores de banco (referência, fora do sistema de tokens)".
 * This module only mirrors that table, one slug per CSS variable declared in
 * `src/styles/tokens.css`.
 *
 * Em 2026-09-11 a lista cresceu: o cinza deixou de ocupar a 6ª vaga da faixa e
 * passou a viver dentro de um color pick, junto de cinco matizes novas. A faixa
 * mostra as cinco de banco como sugestão e, na 6ª vaga, o gatilho do color pick.
 *
 * O 6º rótulo era "Cor extra" (`1091:5087`), não um banco: files_design/02,
 * "C6 Bank saiu da paleta de cores de conta, virou "Cor extra" genérica" —
 * «a 6ª cor virou "Cor extra" — um cinza neutro genérico (#6B7280)». The slug
 * stays `outra` because it is wire data already written to the database
 * (`bankAccountColourSchema`, src/api/contracts/bank-accounts.ts); renaming it
 * would need a migration and would change nothing on screen.
 *
 * The wire type is the CLOSED union `BankAccountColour` (src/domain/assets), and
 * `bankAccountColourSchema` rejects anything else at the border — this palette is
 * the same list, one row per CSS variable. `bankAccountSwatch` still takes a bare
 * `string` and falls back to the neutral "Cor extra" grey because rows written
 * before the list was closed (the fixtures said `conta-roxa`) are read back from
 * a `text` column: a legacy slug renders grey instead of an invisible dot.
 */

import type { BankAccountColour } from '@/domain/assets'

export interface BankAccountSwatch {
  readonly slug: BankAccountColour
  /** pt-BR label of the row in Figma Tokens `1091:2` — shown as the option's accessible label. */
  readonly label: string
  /** The `tokens.css` custom property carrying this swatch's hex. */
  readonly cssVariable: string
  /**
   * O tom do "+" quando esta cor está no gatilho do color pick.
   *
   * Claro por padrão; `'dark'` só onde o claro fica abaixo de 3:1 — hoje, só o
   * ouro. É regra medida, não gosto: o contraste do branco sobre cada extra é
   * verde 4,14 · teal 5,47 · ouro 2,42 · rosa 6,04 · marrom 7,44 · cinza 4,83.
   *
   * O verde é empate técnico (4,14 contra 4,39 do escuro) e fica claro, para
   * não ter dois verdes vizinhos com tratamentos opostos por 0,25 de diferença.
   */
  readonly plusInk?: 'light' | 'dark'
}

/**
 * As cinco de banco — as que a faixa mostra como SUGESTÃO, sempre visíveis.
 *
 * O RÓTULO é o tom, não o banco (decisão do dono, 2026-09-29). Com o nome do
 * banco no rótulo, a coluna "Cor" escrevia "Caixa" ao lado de "BTG Pactual" e
 * "Banco do Brasil" ao lado de "Itaú" — medido na tela com as contas reais. A
 * paleta não escala por banco (o BTG não tem vaga); por tom, escala. O slug, a
 * variável CSS e o hex continuam os de `1091:2`: slug é dado gravado, hex é cor
 * de marca medida. O Figma ainda escreve os nomes de banco em `1091:5055`..
 * `1091:5079` e precisa ser atualizado (files_design/07).
 */
export const BANK_SUGGESTION_SWATCHES: readonly BankAccountSwatch[] = [
  { slug: 'nubank', label: 'Roxo', cssVariable: '--bank-account-nubank' },
  { slug: 'itau', label: 'Laranja', cssVariable: '--bank-account-itau' },
  {
    slug: 'banco-do-brasil',
    label: 'Azul-escuro',
    cssVariable: '--bank-account-banco-do-brasil',
  },
  { slug: 'bradesco', label: 'Vermelho', cssVariable: '--bank-account-bradesco' },
  { slug: 'caixa', label: 'Azul', cssVariable: '--bank-account-caixa' },
] as const

/**
 * As seis EXTRAS, que só aparecem dentro do color pick.
 *
 * O cinza fecha a lista por ser o que já existia — e continua com o slug
 * `outra`, que é dado gravado. Ver `BANK_ACCOUNT_COLOURS` em @/domain/assets.
 */
export const BANK_EXTRA_SWATCHES: readonly BankAccountSwatch[] = [
  { slug: 'green', label: 'Verde', cssVariable: '--bank-account-green' },
  { slug: 'teal', label: 'Verde-azulado', cssVariable: '--bank-account-teal' },
  { slug: 'gold', label: 'Ouro', cssVariable: '--bank-account-gold', plusInk: 'dark' },
  { slug: 'pink', label: 'Rosa', cssVariable: '--bank-account-pink' },
  { slug: 'brown', label: 'Marrom', cssVariable: '--bank-account-brown' },
  { slug: 'outra', label: 'Cinza', cssVariable: '--bank-account-outra' },
] as const

/**
 * A paleta inteira. O color pick mostra TODAS: as de banco também entram nele,
 * senão a pessoa que abriu a janela para procurar teria que fechá-la de novo
 * para escolher um banco (decidido em 2026-09-11).
 */
export const BANK_ACCOUNT_SWATCHES: readonly BankAccountSwatch[] = [
  ...BANK_SUGGESTION_SWATCHES,
  ...BANK_EXTRA_SWATCHES,
] as const

/** Exception 3 (files_design/03): the "Cor" selector always has one swatch pre-selected. */
export const DEFAULT_BANK_ACCOUNT_COLOUR: BankAccountColour = BANK_ACCOUNT_SWATCHES[0]!.slug

export function bankAccountSwatch(slug: string): BankAccountSwatch {
  return (
    BANK_ACCOUNT_SWATCHES.find((swatch) => swatch.slug === slug) ??
    (BANK_ACCOUNT_SWATCHES[BANK_ACCOUNT_SWATCHES.length - 1] as BankAccountSwatch)
  )
}

/**
 * A cor sugerida para uma conta, a partir do NOME — a mesma função no cadastro
 * manual e no "Criar e vincular" do Open Finance, para que apagar tudo e
 * reconectar (ou cadastrar à mão) dê a mesma cor (decisão do dono,
 * 2026-09-29). É sugestão: a pessoa troca no seletor.
 *
 * Banco conhecido → o tom da marca dele (os cinco de `1091:2`, e os parecidos:
 * BTG é azul-marinho, Santander é vermelho, Inter é laranja). Banco
 * desconhecido → uma das cinco extras coloridas, escolhida por uma soma dos
 * códigos das letras do nome normalizado: determinística, então o mesmo nome
 * dá sempre a mesma cor, sem tabela para manter.
 */
const KNOWN_BANKS: readonly (readonly [RegExp, BankAccountColour])[] = [
  [/\bnu(bank| pagamentos)\b/, 'nubank'],
  [/\bitau\b|\biti\b/, 'itau'],
  [/\binter\b/, 'itau'],
  [/\bbanco do brasil\b|\bbb\b/, 'banco-do-brasil'],
  [/\bbtg\b/, 'banco-do-brasil'],
  [/\bbradesco\b/, 'bradesco'],
  [/\bsantander\b/, 'bradesco'],
  [/\bcaixa\b/, 'caixa'],
  [/\bmercado pago\b/, 'caixa'],
  [/\bc6\b/, 'outra'],
  [/\bsicredi\b|\bsicoob\b|\bpicpay\b/, 'green'],
]

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function suggestedColourFor(name: string): BankAccountColour {
  const normalized = normalizeName(name)
  if (normalized === '') return DEFAULT_BANK_ACCOUNT_COLOUR
  for (const [pattern, colour] of KNOWN_BANKS) {
    if (pattern.test(normalized)) return colour
  }
  const coloured = BANK_EXTRA_SWATCHES.filter((swatch) => swatch.slug !== 'outra')
  let sum = 0
  for (const char of normalized) sum += char.charCodeAt(0)
  return coloured[sum % coloured.length]!.slug
}

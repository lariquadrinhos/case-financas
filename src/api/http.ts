/**
 * The HTTP conventions of this product, in ONE place.
 *
 * This module is the vocabulary — paths, status codes, the problem document, the
 * error table. It imports NOTHING from the server runtime on purpose: the
 * contracts in `src/api/contracts/` build on it, and they must stay loadable in
 * a plain Node process so `npm run api:spec` can generate the document. The
 * wrapper that needs a session lives next door, in `handler.ts`.
 *
 * Conventions fixed here:
 *   - Versioned base path `/api/v1`, resource-oriented, plural nouns.
 *   - API paths are ENGLISH. They are infrastructure, not interface — the
 *     screens' routes stay in pt-BR (`/inicio`, `/dre`), the API does not
 *     (ADR-0010).
 *   - Money on the wire is an INTEGER of cents, never a float of reais
 *     (ADR-0001 §5). Dates are "YYYY-MM-DD", months "YYYY-MM".
 *   - Errors are RFC 9457 `application/problem+json`.
 *   - A list response is `{ data: [...], meta: { total } }`; a single resource
 *     is returned as the object itself.
 */

/* -------------------------------------------------------------------------
 * Paths
 * ---------------------------------------------------------------------- */

export const API_VERSION = 'v1'
export const API_BASE_PATH = `/api/${API_VERSION}`

/** `resourcePath('entries', id)` → `/api/v1/entries/<id>`. Used to build `Location`. */
export function resourcePath(...segments: readonly string[]): string {
  return [API_BASE_PATH, ...segments.map((s) => encodeURIComponent(s))].join('/')
}

/* -------------------------------------------------------------------------
 * Status codes — the closed list this API uses
 * ---------------------------------------------------------------------- */

export const STATUS = {
  ok: 200,
  created: 201,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  internal: 500,
} as const

export type StatusCode = (typeof STATUS)[keyof typeof STATUS]

/* -------------------------------------------------------------------------
 * RFC 9457 problem+json
 * ---------------------------------------------------------------------- */

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

/**
 * `type` is a URN, not an https URL: RFC 9457 only requires a URI, and a URN
 * cannot be dereferenced. A resolvable URL would invite a client to fetch it,
 * which is exactly the external origin ADR-0009 §5 forbids.
 */
export function problemType(code: string): string {
  return `urn:bigorna:problem:${code}`
}

/** One field-level validation failure. `field` is a JSON path, `code` a Zod issue code. */
export interface ProblemFieldError {
  readonly field: string
  readonly code: string
}

/**
 * The error body every endpoint returns. `detail` is written for a person and
 * NEVER carries a stack trace, a SQL string, a file path or a monetary amount
 * (ADR-0009 §3): an error body is copied into tickets and logs by hand.
 */
export interface ProblemDetails {
  readonly type: string
  readonly title: string
  readonly status: number
  readonly detail: string
  readonly instance: string
  /** Machine-readable, snake_case, namespaced: `entries.negative_paid_amount`. */
  readonly code: string
  readonly errors?: readonly ProblemFieldError[]
}

/** pt-BR titles: a problem body is read by the person, and the product speaks pt-BR (ADR-0010). */
const TITLES: Record<number, string> = {
  400: 'Requisição malformada',
  401: 'Sem sessão',
  404: 'Recurso não encontrado',
  409: 'Conflito com o estado atual',
  422: 'Requisição inválida',
  500: 'Erro inesperado',
}

export function problem(
  status: number,
  code: string,
  detail: string,
  instance: string,
  errors?: readonly ProblemFieldError[],
): Response {
  const body: ProblemDetails = {
    type: problemType(code),
    title: TITLES[status] ?? 'Erro',
    status,
    detail,
    instance,
    code,
    ...(errors ? { errors } : {}),
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE },
  })
}

/* -------------------------------------------------------------------------
 * Success helpers
 * ---------------------------------------------------------------------- */

const JSON_HEADERS = { 'content-type': 'application/json' } as const

export function ok<T>(body: T): Response {
  return new Response(JSON.stringify(body), { status: STATUS.ok, headers: JSON_HEADERS })
}

/** 201 always carries `Location` — a client that just created a resource must be able to read it back. */
export function created<T>(location: string, body: T): Response {
  return new Response(JSON.stringify(body), {
    status: STATUS.created,
    headers: { ...JSON_HEADERS, location },
  })
}

export function noContent(): Response {
  return new Response(null, { status: STATUS.noContent })
}

/** The list envelope. `total` is the count BEFORE pagination, so a client can page. */
export interface ListEnvelope<T> {
  readonly data: readonly T[]
  readonly meta: { readonly total: number }
}

export function list<T>(data: readonly T[], total = data.length): Response {
  const body: ListEnvelope<T> = { data, meta: { total } }
  return ok(body)
}

/* -------------------------------------------------------------------------
 * Domain error → HTTP status, in ONE table
 * ---------------------------------------------------------------------- */

/**
 * Every error code the domain throws today (`grep -rn "throw new Error" src/domain`),
 * mapped once. The rule behind the mapping:
 *
 *   404 — the request names something that does not exist.
 *   409 — the request is well-formed but fights the resource's current state
 *         (already closed, already used, a name already taken, a fixed record).
 *   422 — the request is well-formed and the target exists, but the values
 *         break a rule (a fraction of a cent, a date that is not a date).
 *   500 — the STORED data is inconsistent. The client did nothing wrong and
 *         retrying will not help; the body says nothing else (ADR-0009).
 *
 * A code missing from this table is a 500 on purpose: an unmapped error is an
 * unexamined one, and guessing a 4xx would tell the client its request was at
 * fault without anyone having checked.
 */
export const DOMAIN_ERROR_STATUS: Readonly<Record<string, number>> = {
  // core
  'money.invalid_amount': STATUS.unprocessable,
  'money.not_an_integer': STATUS.unprocessable,
  'money.invalid_factor': STATUS.unprocessable,
  'money.invalid_part_count': STATUS.unprocessable,
  'time.invalid_date': STATUS.unprocessable,
  'time.nonexistent_date': STATUS.unprocessable,
  'time.invalid_month': STATUS.unprocessable,

  // entries
  'entries.negative_paid_amount': STATUS.unprocessable,
  'entries.patch_changes_kind': STATUS.conflict,
  'entries.unknown_entry': STATUS.notFound,
  'entries.in_use': STATUS.conflict,
  // "Desfazer" num lançamento que o banco pagou (dono, 2026-10-06).
  'entries.paid_by_bank': STATUS.conflict,
  // "Vincular ao banco": a transação escolhida não está entre as candidatas.
  'entries.not_a_bank_link_candidate': STATUS.unprocessable,
  // The body named a Categoria/Conta/Recorrência that does not exist for this
  // user — a RESTRICT foreign key of `entries` (schema.ts). The request names
  // something absent, which is the 404 rule above, not a broken store.
  'entries.unknown_reference': STATUS.notFound,
  // Despesa em bloco de receita, ou o contrário (blockAcceptsKind).
  'entries.category_kind_mismatch': STATUS.unprocessable,

  // discretionary spending
  'discretionary_spending.negative_amount': STATUS.unprocessable,
  'discretionary_spending.not_configured': STATUS.conflict,
  'discretionary_spending.expense_not_found': STATUS.notFound,
  // The body named a Conta Bancária (or the fixed "Consumo Livre" categoria)
  // that does not exist for this user — a RESTRICT foreign key of
  // `discretionary_spending_config`/`entries` (schema.ts). Same rule as
  // `entries.unknown_reference`: the request names something absent.
  'discretionary_spending.unknown_reference': STATUS.notFound,

  // pending allocations — "Direcionar agora" (files_design/01 §13)
  'pending_allocation.already_allocated': STATUS.conflict,
  'pending_allocation.no_allocations': STATUS.unprocessable,
  'pending_allocation.allocations_do_not_match_amount': STATUS.unprocessable,
  'pending_allocations.not_found': STATUS.notFound,

  // pending items — Pendência unificada, tipo 4 (H13)
  'payment_discrepancy.already_resolved': STATUS.conflict,
  'payment_discrepancies.not_found': STATUS.notFound,

  // chart of accounts
  'chart_of_accounts.blank_name': STATUS.unprocessable,
  'chart_of_accounts.block_refuses_categories': STATUS.unprocessable,
  'chart_of_accounts.duplicate_id': STATUS.conflict,
  'chart_of_accounts.duplicate_name': STATUS.conflict,
  'chart_of_accounts.system_category_is_fixed': STATUS.conflict,
  'chart_of_accounts.unknown_block': STATUS.notFound,
  'chart_of_accounts.unknown_category': STATUS.notFound,

  // liabilities
  'installment_schedule.invalid_installment_count': STATUS.unprocessable,
  'installment_schedule.invalid_installments_already_paid': STATUS.unprocessable,
  'installment_schedule.invalid_original_amount': STATUS.unprocessable,
  'installment_schedule.invalid_rate': STATUS.unprocessable,
  'rate_adjustment.invalid_rate': STATUS.unprocessable,
  'rate_adjustment.liability_mismatch': STATUS.conflict,

  // profit allocation
  'profit_allocation.destination_does_not_match_bucket': STATUS.unprocessable,
  // P14 — direcionar a sobra do Consumo Livre. Mesmo par e mesmos status de
  // `profit_allocation`, porque é o mesmo formato de problema: alocar um valor
  // maior do que o disponível, ou um valor que não é valor.
  'leftover_direction.exceeds_pending': STATUS.unprocessable,
  'leftover_direction.non_positive_amount': STATUS.unprocessable,
  'profit_allocation.exceeds_net_profit': STATUS.unprocessable,
  'profit_allocation.negative_amount': STATUS.unprocessable,
  'profit_allocation.no_profit_to_allocate': STATUS.conflict,
  'profit_allocation.item_not_found': STATUS.notFound,
  // An item's destino named an Investimento or uma Conta Bancária that does not
  // exist for this user — a RESTRICT foreign key of `allocation_items`.
  'profit_allocation.unknown_reference': STATUS.notFound,

  // recurrence
  'recurrence.already_closed': STATUS.conflict,
  'recurrence.cannot_discard_paid_occurrence': STATUS.conflict,
  'recurrence.occurrence_not_open': STATUS.conflict,
  'recurrence.this_only_changes_amount_and_description': STATUS.unprocessable,
  'recurrence.kind_change': STATUS.conflict,
  'recurrence.occurrence_of_another_series': STATUS.conflict,
  'recurrence.occurrence_not_found': STATUS.notFound,
  'recurrence.unknown_recurrence': STATUS.notFound,
  'recurrence.in_use': STATUS.conflict,
  // "Descontar da próxima ocorrência" (ADR-0017 §5). 409 e não 422: o corpo
  // está bem formado e a escolha existe — quem não comporta é o estado da
  // série (acabou, ainda é "a definir", ou o excesso não cabe no mês seguinte).
  'recurrence.no_next_occurrence': STATUS.conflict,
  'recurrence.next_amount_to_be_defined': STATUS.conflict,
  'recurrence.deduction_does_not_fit': STATUS.conflict,
  // 422: o corpo é válido e a opção existe no enum — o que não existe é a
  // operação, porque creditar um destino com dinheiro que já saiu da conta
  // inflaria o Balanço (ADR-0017 §5).
  'overpayment.redirect_not_supported': STATUS.unprocessable,
  'recurrence.unknown_reference': STATUS.notFound,
  'occurrence.unknown_occurrence': STATUS.notFound,

  // reports — these mean the stored chart of accounts contradicts the entries
  'income_statement.invalid_month': STATUS.unprocessable,
  'income_statement.category_without_block': STATUS.internal,
  'income_statement.missing_block': STATUS.internal,
  'income_statement.role_without_category': STATUS.internal,
  // indicators — same rule: a missing cascade line means the stored chart of
  // accounts is inconsistent, and `unknown_key` means the catalogue itself
  // (INDICATOR_DEFINITIONS) is missing an entry — neither is the client's fault.
  'indicators.missing_block': STATUS.internal,
  'indicators.missing_subtotal': STATUS.internal,
  'indicators.unknown_key': STATUS.internal,
  // monthly trend
  'monthly_trend.invalid_range': STATUS.unprocessable,
  'monthly_trend.missing_block': STATUS.internal,
  'monthly_trend.missing_subtotal': STATUS.internal,

  // assets — instalments and the sale of a bem material
  'installment_payment.already_paid': STATUS.conflict,
  'installment_payment.negative_amount': STATUS.unprocessable,
  // "Descartar" só existe na lista do que ainda está Previsto (Figma 10:2 nó
  // 144:17, files_design/01 §6) — pedir isso de uma Parcela já Paga é estado,
  // não valor quebrado.
  'installment.cannot_discard_paid_installment': STATUS.conflict,
  'asset_sale.asset_mismatch': STATUS.conflict,
  'asset_sale.already_sold': STATUS.conflict,
  'asset_sale.negative_amount': STATUS.unprocessable,
  'asset_sale.allocations_exceed_amount': STATUS.unprocessable,

  // Patrimônio — Contas Bancárias, Bens Materiais, Investimentos, Passivos.
  // `.not_found` is thrown by a repository's `replace()` when the id targets
  // no row of THIS user (ADR-0008 §3 — same as `chart_of_accounts.unknown_*`
  // above); `.in_use` is `isForeignKeyViolation` translated from the RESTRICT
  // foreign keys in schema.ts (ADR-0012 §2) on `remove()`.
  'bank_accounts.not_found': STATUS.notFound,
  'bank_accounts.in_use': STATUS.conflict,
  'tangible_assets.not_found': STATUS.notFound,
  'tangible_assets.in_use': STATUS.conflict,
  'investments.not_found': STATUS.notFound,
  'investments.in_use': STATUS.conflict,
  'liabilities.not_found': STATUS.notFound,
  'liabilities.in_use': STATUS.conflict,
  'installments.not_found': STATUS.notFound,

  // Transferência (ADR-0017 §2). Todos são 409: o pedido está bem formado e
  // faz sentido em abstrato, mas briga com o estado atual — saldo que não
  // cobre, origem igual ao destino, soma que não fecha. `unknown_position` é
  // 404 pelo mesmo critério das outras rotas: o corpo nomeia algo ausente.
  'transfer.amount_not_positive': STATUS.unprocessable,
  'transfer.sources_do_not_sum': STATUS.unprocessable,
  'transfer.same_position': STATUS.conflict,
  'transfer.insufficient_balance': STATUS.conflict,
  'transfer.unknown_position': STATUS.notFound,

  // Direcionamento com destino Passivo (ADR-0017 §4). 422 e não 409: o
  // pedido é bem formado e o passivo existe — o que não existe é a operação,
  // porque abater dívida por direcionamento é decisão de produto em aberto.
  'allocations.liability_not_supported': STATUS.unprocessable,

  // Open Finance (ADR-0020). `account_is_linked` é 409: o pedido é válido, mas
  // numa posição vinculada o banco é a testemunha do fato e um Pago manual
  // duplicaria o que ele informa. `not_configured` é 409 pelo mesmo critério:
  // o estado da instalação (sem credenciais) é que não comporta o pedido.
  'open_finance.account_is_linked': STATUS.conflict,
  'open_finance.not_configured': STATUS.conflict,
  'open_finance.unknown_provider_account': STATUS.notFound,
  'open_finance.unknown_target': STATUS.notFound,
  'open_finance.target_kind_mismatch': STATUS.unprocessable,
  // A escolha não existe para o sentido (pró-labore de PF para PJ).
  'open_finance.transfer_classification_not_allowed': STATUS.unprocessable,
  // Um vínculo apontando para conta que não existe: o CASCADE de
  // `open_finance_links` torna isso impossível, então é dado inconsistente.
  'open_finance.unknown_bank_account': STATUS.internal,
  // O provedor não respondeu. 409 e não 500: nada do nosso lado está
  // inconsistente, e tentar de novo mais tarde pode funcionar.
  'open_finance.provider_unavailable': STATUS.conflict,
}

/**
 * The sentence the person reads for a code that needs one. Optional: a code
 * absent here gets the generic "A operação não pôde ser concluída." — which is
 * fine for a request no screen can produce, and useless for a refusal the
 * person will meet in normal use, like the one below.
 */
export const DOMAIN_ERROR_DETAIL: Readonly<Record<string, string>> = {
  'recurrence.this_only_changes_amount_and_description':
    'Só este mês muda o valor e a descrição. Para mudar categoria, conta ou entidade, escolha "Toda a série".',
  'recurrence.kind_change':
    'O tipo do lançamento não muda na edição da recorrência. Para trocar despesa por receita, descarte a série e lance de novo.',
  'entries.category_kind_mismatch':
    'Esta categoria não combina com o tipo do lançamento: despesa não entra em Receita Bruta, e receita não entra num bloco de despesa. Pró-labore pago pela PJ vai na aba Pró-labore e Distribuição.',
  'profit_allocation.exceeds_net_profit':
    'O valor destinado passa do Lucro Líquido consolidado do mês (PF e PJ juntos). Reduza algum item.',
  'entries.not_a_bank_link_candidate':
    'Esta transação não pode ser ligada a este lançamento: precisa ser da mesma conta, no mesmo sentido, até 15 dias de distância, e ainda não estar ligada a outro.',
  'entries.paid_by_bank':
    'Este pagamento veio do banco pelo Open Finance e não pode ser desfeito: o extrato é o fato.',
  'open_finance.account_is_linked':
    'Esta conta está vinculada ao Open Finance: o que é pago nela chega pelo banco. Lance como Previsto, ou desvincule a conta.',
  'open_finance.not_configured':
    'O Open Finance não está configurado nesta instalação (PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS no .env).',
  'open_finance.provider_unavailable':
    'O Open Finance não respondeu agora. Os dados da última sincronização continuam valendo.',
  'open_finance.target_kind_mismatch':
    'Este tipo de conta do banco não pode apontar para esse tipo de cadastro.',
}

/**
 * The code the data layer throws when a row exists but belongs to someone else,
 * or does not exist at all. Both answer 404: telling a caller that a row exists
 * under another `userId` is itself a disclosure (ADR-0008 §3).
 */
export const NOT_FOUND_CODE = 'resource.not_found'

/** Raised by a handler when the addressed resource is absent for this `userId`. */
export class NotFoundError extends Error {
  readonly detail: string

  constructor(detail = 'O recurso solicitado não existe.') {
    super(NOT_FOUND_CODE)
    this.name = 'NotFoundError'
    this.detail = detail
  }
}

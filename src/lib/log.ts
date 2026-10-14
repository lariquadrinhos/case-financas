/**
 * Structured logging — ADR-0009 §3.
 *
 * Hard rule: the log records THAT something happened, never WHAT. Monetary
 * amounts, category names, account names, labels and any text the person typed
 * are personal financial data and never appear here. Only the event, the
 * outcome, and opaque identifiers.
 *
 * `console.log` is banned in `src/` by an ESLint rule precisely so that this is
 * the only path.
 */

type Level = 'info' | 'warn' | 'error'

/** Only non-sensitive keys and values. No free-form text coming from the person. */
export type LogContext = Record<string, string | number | boolean | null>

const FORBIDDEN_KEYS = new Set([
  'amount',
  'paidAmount',
  'plannedAmount',
  'balance',
  'name',
  'label',
  'caption',
  'description',
  'category',
  'account',
  'creditor',
  'email',
  'cpf',
  'cnpj',
])

function redact(context: LogContext): LogContext {
  const clean: LogContext = {}
  for (const [key, value] of Object.entries(context)) {
    clean[key] = FORBIDDEN_KEYS.has(key) ? '[redacted]' : value
  }
  return clean
}

function emit(level: Level, event: string, context: LogContext = {}): void {
  console.error(JSON.stringify({ level, event, ...redact(context) }))
}

export const log = {
  info: (event: string, context?: LogContext) => emit('info', event, context),
  warn: (event: string, context?: LogContext) => emit('warn', event, context),
  error: (event: string, context?: LogContext) => emit('error', event, context),
}

/**
 * Importing this module registers EVERY resource in the OpenAPI registry.
 *
 * Registration is a side effect of importing a contract file, so the generated
 * document is only complete if every file is reachable from here. A new resource
 * that is not listed below is invisible in `docs/api/openapi.json` — which is
 * the diff that reveals it.
 */

import './common'
import './entries'
import './chart-of-accounts'
import './bank-accounts'
import './tangible-assets'
import './investments'
import './liabilities'
import './recurrences'
import './profit-allocations'
import './pending-allocations'
import './pending-items'
import './trace-events'
import './discretionary-spending'
import './reports'
import './open-finance'

export * from './common'
export * from './entries'
export * from './chart-of-accounts'
export * from './bank-accounts'
export * from './tangible-assets'
export * from './investments'
export * from './liabilities'
export * from './recurrences'
export * from './profit-allocations'
export * from './pending-allocations'
export * from './pending-items'
export * from './trace-events'
export * from './discretionary-spending'
export * from './reports'
export * from './open-finance'

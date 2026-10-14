/**
 * `GET /api/v1/statement-blocks` — the 10 fixed blocks of the DRE.
 *
 * Read-only over HTTP on purpose: the person cannot create, rename or reorder
 * a block (PRD §1 — "Os 10 blocos são fixos; criar ou redefinir bloco não faz
 * parte do MVP"). Writing them happens only from the onboarding feature, via
 * `StatementBlockWriter.seed`, never through this route.
 */

import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'

export const GET = handler({
  operation: 'chart_of_accounts.list_statement_blocks',
  handle: async ({ session }) => {
    const { statementBlockReader } = getRepositories()
    const blocks = await statementBlockReader.list(session.userId)
    return list(blocks)
  },
})

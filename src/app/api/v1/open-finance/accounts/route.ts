/**
 * `GET /api/v1/open-finance/accounts` — the accounts the bank reports, each
 * with what it is linked to in Bigorna (ADR-0020 §3). It is what the "Conta no
 * Open Finance" dropdown lists. Read live from the provider: there is no copy
 * of this list in our database to go stale.
 */

import { getOpenFinanceReader, getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'

export const GET = handler({
  operation: 'open_finance.list_accounts',
  handle: async ({ session }) => {
    const { openFinanceLinkReader } = getRepositories()
    const accounts = await getOpenFinanceReader().listAccounts(session.userId)
    const links = await openFinanceLinkReader.list(session.userId)
    return list(
      accounts.map((account) => {
        const link = links.find((l) => l.providerAccountId === account.id)
        return {
          ...account,
          link: link === undefined ? null : { target: link.target, linkedOn: link.linkedOn },
        }
      }),
    )
  },
})

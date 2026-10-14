import { ensureChartOfAccountsSeeded } from '@/features/onboarding/seed-chart'
import { getSession } from '@/server/session'
import { PlanoDeContasStep } from './_components/plano-de-contas-step'

/**
 * Server Component wrapper: seeds the 10 fixed blocks (and their example
 * categories) the moment a person reaches this step for the first time, then
 * hands off to the interactive accordion. See `ensureChartOfAccountsSeeded`
 * for why this has to happen here, before any read.
 */
export default async function PlanoDeContasPage() {
  const session = await getSession()
  await ensureChartOfAccountsSeeded(session.userId)

  return <PlanoDeContasStep />
}

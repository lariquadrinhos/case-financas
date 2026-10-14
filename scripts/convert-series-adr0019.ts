/**
 * ADR-0019 — converte as séries criadas antes da decisão para o formato atual.
 *
 *   node --import ./scripts/register-ts-alias.mjs scripts/convert-series-adr0019.ts [--apply] [--user=<id>]
 *
 * `--user` tem como padrão `development-user`, o usuário fixo que
 * `src/server/session.ts` entrega enquanto não há login (fase 1). O script não
 * chama `getSession()` porque aquele módulo é `server-only` e só carrega no Next.
 *
 * Sem `--apply` só simula. Idempotente: rodar de novo não converte nada. Uma
 * transação por série. Como o seed, imprime só contagens e ids opacos — nunca
 * valor, nome de categoria ou texto digitado (src/lib/log.ts).
 */
import { planSeriesConversion } from '@/domain/recurrence'
import { getRepositories, withTransaction } from '@/data'
import { asId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'

async function main() {
  const apply = process.argv.includes('--apply')
  const userArg = process.argv.find((arg) => arg.startsWith('--user='))
  const userId = asId<UserId>(
    userArg === undefined ? 'development-user' : userArg.slice('--user='.length),
  )
  const { recurrenceReader, entryReader, occurrenceReader } = getRepositories()

  const series = await recurrenceReader.listOpen(userId)
  let converted = 0
  for (const recurrence of series) {
    const entries = await entryReader.listByRecurrence(userId, recurrence.id)
    const occurrences = await occurrenceReader.listByRecurrence(userId, recurrence.id)
    const plan = planSeriesConversion(recurrence, entries, occurrences)
    if (plan === null) continue
    converted += 1
    process.stderr.write(
      `série ${recurrence.id.slice(0, 8)}: início ${recurrence.startDate} → ${plan.recurrence.startDate}, ` +
        `ocorrência ${plan.firstOccurrence.month} ${plan.firstOccurrence.status}` +
        `${plan.removeEntryId === null ? '' : `, lançamento ${plan.removeEntryId.slice(0, 8)} vira a ocorrência`}\n`,
    )
    if (!apply) continue
    await withTransaction(async ({ recurrenceWriter, occurrenceWriter, entryWriter }) => {
      await recurrenceWriter.replace(userId, plan.recurrence)
      await occurrenceWriter.create(userId, plan.firstOccurrence)
      if (plan.removeEntryId !== null) await entryWriter.remove(userId, plan.removeEntryId)
    })
  }
  process.stderr.write(
    `${apply ? 'convertidas' : 'a converter (simulação)'}: ${converted} de ${series.length} séries abertas\n`,
  )
}

main().catch((error: unknown) => {
  process.stderr.write(`conversão falhou: ${error instanceof Error ? error.message : 'erro'}\n`)
  process.exit(1)
})

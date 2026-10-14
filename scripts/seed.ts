/**
 * Popula o banco de arquivo (`./.data/bigorna.db` por padrão, ou
 * `DATABASE_PATH`) com o cenário sintético de `src/data/fixtures/seed.ts`.
 *
 * Run com `npm run db:seed`. Mesma convenção de execução de
 * `scripts/generate-openapi.ts`: Node 24 despe os tipos sozinho, e
 * `register-ts-alias.mjs` resolve `@/*` e os imports relativos sem extensão.
 *
 * Não imprime nenhum valor monetário nem nome digitado pela pessoa — só
 * contagens e identificadores opacos, no mesmo espírito de `src/lib/log.ts`
 * (ADR-0009 §3), mesmo este script vivendo fora de `src/`.
 */

import { openDatabase } from '@/data/sqlite/client'
import { SEED_MONTH, SEED_USER_ID, seed } from '@/data/fixtures/seed'

async function main(): Promise<void> {
  const { db, connection } = openDatabase()
  try {
    const summary = await seed(db, SEED_USER_ID)
    // stderr, não stdout: `no-console` só libera `console.error` (ADR-0009 §3).
    console.error(
      `seed: usuário ${summary.userId} · ${summary.months.length} meses (semente ${SEED_MONTH}) · ok`,
    )
  } finally {
    connection.close()
  }
}

main().catch((error: unknown) => {
  console.error('seed: falhou —', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

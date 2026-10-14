import 'server-only'

import {
  DEFAULT_BLOCKS,
  DEFAULT_CATEGORIES,
  UNCATEGORIZED_CATEGORIES,
} from '@/domain/chart-of-accounts'
import { getRepositories } from '@/data'
import type { UserId } from '@/server/session'

/**
 * Onboarding 1 (Plano de Contas) is the one screen allowed to write the 10
 * fixed blocks: `GET /api/v1/statement-blocks` is read-only over HTTP on
 * purpose ("Writing them happens only from the onboarding feature, via
 * StatementBlockWriter.seed, never through this route" —
 * src/app/api/v1/statement-blocks/route.ts), and `src/features/onboarding` is
 * exactly the seam docs/ARCHITECTURE.md §2 reserves for that orchestration.
 *
 * DOIS chamadores, ambos Server Components, e os dois antes de qualquer leitura:
 *
 *  - `src/app/onboarding/plano-de-contas/page.tsx` — uma página que lesse antes
 *    mostraria um Plano de Contas vazio na primeira visita, o único momento que
 *    esse passo existe para evitar;
 *  - `src/app/(app)/layout.tsx` — acrescentado em 2026-09-14, porque o passo do
 *    onboarding PODE ser pulado por desenho ("Fazer depois", Wireframe `116:11`,
 *    "pula pra Home") e sem os blocos a Home, o DRE, a Evolução Mensal e os
 *    Indicadores respondiam 500 (`income_statement.missing_block`). Os 10 blocos
 *    são fixos para todo mundo (PRD §1, §9.5): o onboarding existe para editar
 *    as categorias dentro deles, não para criar a estrutura.
 *
 * Idempotent: `statementBlockReader.list` is checked first, so revisiting this
 * step (Voltar, or resuming after "Salvar e continuar depois") never reseeds
 * over a plano the person has already started editing. `categoryWriter.seed`
 * itself is also idempotent (src/data/sqlite/chart-of-accounts.repository.test.ts:
 * "seeding twice is idempotent"), which is why checking only the blocks is
 * enough — the two are always seeded together, in the same call, below.
 */
export async function ensureChartOfAccountsSeeded(userId: UserId): Promise<void> {
  const { statementBlockReader, statementBlockWriter, categoryWriter } = getRepositories()

  const existing = await statementBlockReader.list(userId)
  if (existing.length > 0) {
    // "A categorizar" (PRD v7.46) chegou depois do plano de referência: quem já
    // tinha plano ganha só as duas categorias de sistema, num upsert idempotente.
    await categoryWriter.seed(userId, UNCATEGORIZED_CATEGORIES)
    return
  }

  await statementBlockWriter.seed(userId, DEFAULT_BLOCKS)
  await categoryWriter.seed(userId, [...DEFAULT_CATEGORIES, ...UNCATEGORIZED_CATEGORIES])
}

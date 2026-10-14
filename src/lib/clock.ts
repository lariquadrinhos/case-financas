/**
 * The one place ANY layer outside the domain reads the system clock.
 *
 * `src/domain` never calls `Date.now()` (src/domain/README.md, "Pureza") — every
 * domain function that needs "when this happened" takes it as a parameter. A
 * route is the edge, so it is where "now" is allowed to exist, and this module
 * is the single spot that does it, rather than every route inventing its own
 * `new Date()` formatting.
 *
 * Moved here from `src/api/clock.ts` when P21 gave the data layer a reason to
 * need "hoje" too (o retrato mensal do PL é carimbado com a data em que foi
 * tirado). `src/data` não pode importar `@/api` — e a alternativa, um segundo
 * `new Date()` lá dentro, criaria uma segunda definição de "hoje", que é
 * exatamente o que a P29 abaixo trata.
 *
 * P29, decidido em 2026-09-09: "hoje" é a **hora local do processo do servidor**,
 * e a decisão vem com a condição de validade escrita — **ela vale enquanto a
 * implantação for local** (ADR-0007 §1: monolito local, uma pessoa, mesma
 * máquina). Nesse arranjo o relógio do processo É o relógio da pessoa, e um
 * fuso configurável seria um campo que nenhuma tela do Figma desenha para
 * resolver um problema que não existe.
 *
 * Se a implantação deixar de ser local, a resposta muda: passa a ser um fuso
 * explícito, guardado como preferência da pessoa, com `todayIsoDate()`
 * recebendo-o. Isso é mudança arquitetural e vale ADR nova — não é ajuste desta
 * função.
 */

import { isoDate } from '@/domain/core'
import type { IsoDate } from '@/domain/core'

export function todayIsoDate(): IsoDate {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return isoDate(`${year}-${month}-${day}`)
}

/**
 * Writes `docs/api/openapi.json` from the Zod contracts.
 *
 * Run with `npm run api:spec`. The output is COMMITTED: the point of generating
 * it is that a pull request which changes a field shows the contract change as a
 * diff, instead of the change being discovered by whoever writes the client.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildOpenApiDocument } from '@/api/openapi'

const target = resolve(process.cwd(), 'docs/api/openapi.json')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`, 'utf8')

// stderr, not stdout: `console.log` is banned in this repo (ADR-0009 §3), and
// this line carries a path, never product data.
console.error(`openapi: ${target}`)

/**
 * The single OpenAPI registry, and the single already-extended `z`.
 *
 * `extendZodWithOpenApi` patches the Zod prototype and MUST run before any
 * schema calls `.openapi()`. Re-exporting `z` from here is what guarantees the
 * order: a contract file cannot obtain `z` without first importing this module.
 * Importing `zod` directly inside `src/api/contracts/` is therefore a defect —
 * it works until the first file that imports a contract before the registry.
 */

import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

export { z }

/**
 * A module resolution hook so a plain `node` process can run the project's TypeScript.
 *
 * Node 24 strips types on its own; what it does not do is understand the two
 * conventions this repo uses everywhere: the `@/*` path alias of `tsconfig.json`
 * and extensionless relative imports. Both are resolved here, so
 * `scripts/generate-openapi.ts` runs the SAME modules the app imports instead of
 * a copy kept in sync by hand.
 *
 * Deliberately not a dependency: adding a TypeScript runner to `package.json`
 * for one build script is a supply-chain cost, and ADR-0009 §5 makes every
 * dependency a decision rather than a convenience.
 */

import { statSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.js', '/index.ts', '/index.tsx']

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function firstExisting(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${basePath}${suffix}`
    if (isFile(candidate)) return candidate
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const file = firstExisting(resolvePath(projectRoot, 'src', specifier.slice(2)))
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parentPath = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : projectRoot
    const file = firstExisting(resolvePath(parentPath, specifier))
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }

  return nextResolve(specifier, context)
}

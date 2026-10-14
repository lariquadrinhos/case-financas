/**
 * Installs `ts-alias-loader.mjs` for the process that follows.
 *
 * A separate file because `node --import` needs a module that CALLS `register`;
 * the hook itself only exports `resolve`.
 */

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./ts-alias-loader.mjs', import.meta.url ?? pathToFileURL('./').href)

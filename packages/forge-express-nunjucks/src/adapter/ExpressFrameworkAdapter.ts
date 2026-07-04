import type express from 'express'
import type { Forge, ForgeRouterAdapter } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from './createExpressRouter'
import type { ExpressForgeRouterOptions } from './createExpressRouter'

// Mirrors forge-core's internal `ForgeDeprecations` (which isn't a public export) so this package
// need not import core internals. The `Symbol.for` key is process-global, so this shares core's
// seen-codes set and dedupes against its warnings across bundles in the same process.
const SEEN_CODES = Symbol.for('forge:deprecations')

interface DeprecationsGlobal {
  [SEEN_CODES]?: Set<string>
}

function seenCodes(): Set<string> {
  const store = globalThis as DeprecationsGlobal
  const existing = store[SEEN_CODES]

  if (existing) {
    return existing
  }

  const seen = new Set<string>()
  store[SEEN_CODES] = seen

  return seen
}

function warnOnce(code: string, message: string): void {
  const seen = seenCodes()

  if (seen.has(code)) {
    return
  }

  seen.add(code)
  process.emitWarning(message, { type: 'DeprecationWarning', code })
}

/**
 * @deprecated Build the router directly with `createExpressRouter(forge, options)`.
 */
export interface ExpressForgeAdapter extends ForgeRouterAdapter {
  build(forge: Forge): express.Router
}

/**
 * @deprecated Build the router directly with `createExpressRouter(forge, options)`.
 */
export const ExpressFrameworkAdapter = {
  configure(options: ExpressForgeRouterOptions): ExpressForgeAdapter {
    warnOnce(
      'FORGE_DEP_ExpressFrameworkAdapter',
      'ExpressFrameworkAdapter is deprecated - build the router directly with createExpressRouter(forge, options).',
    )

    return {
      build: (forge: Forge) => createExpressRouter(forge, options),
    }
  },
}

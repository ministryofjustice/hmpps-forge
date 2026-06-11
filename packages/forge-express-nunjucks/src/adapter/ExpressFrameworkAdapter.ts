import type express from 'express'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from './createExpressRouter'
import type { ExpressForgeRouterOptions } from './createExpressRouter'

/**
 * @deprecated Build the router directly instead —
 * `app.use(createExpressRouter(forge, { nunjucksEnv }))`.
 */
export interface ExpressForgeAdapter {
  build(forge: Forge): express.Router
}

/**
 * Back-compatible configuration entry point for the Express adapter.
 *
 * `ExpressFrameworkAdapter.configure(options)` returns a builder you pass to
 * `new Forge({ frameworkAdapter })`; `forge.getRouter()` then yields the Express
 * router. It is a thin wrapper over {@link createExpressRouter} — both styles
 * compose the same orchestrator and renderer.
 *
 * @deprecated Prefer the direct style:
 * ```typescript
 * const forge = new Forge({ logger }).registerPackage(myPackage)
 * app.use(createExpressRouter(forge, { nunjucksEnv }))
 * ```
 */
export const ExpressFrameworkAdapter = {
  configure(options: ExpressForgeRouterOptions): ExpressForgeAdapter {
    return {
      build: (forge: Forge) => createExpressRouter(forge, options),
    }
  },
}

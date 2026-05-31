import type express from 'express'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from './createExpressRouter'
import type { ExpressForgeRouterOptions } from './createExpressRouter'

export interface ExpressForgeAdapter {
  build(forge: Forge): express.Router
}

/**
 * Back-compatible configuration entry point for the Express adapter.
 *
 * `ExpressFrameworkAdapter.configure(options)` returns a builder you pass to
 * `new Forge({ frameworkAdapter })`; `forge.getRouter()` then yields the Express
 * router. It is a thin wrapper over {@link createExpressRouter} — both styles
 * produce the same router, so use whichever you prefer:
 *
 * ```typescript
 * // builder style
 * const forge = new Forge({ frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }) })
 * app.use(forge.getRouter() as express.Router)
 *
 * // direct style
 * const forge = new Forge({ logger... }).registerFormPackage({ ... })
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

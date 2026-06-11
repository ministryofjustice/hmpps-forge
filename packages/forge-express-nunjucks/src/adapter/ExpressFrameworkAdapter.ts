import type express from 'express'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from './createExpressRouter'

export interface ExpressForgeAdapter {
  build(forge: Forge<string>): express.Router
}

/**
 * Back-compatible configuration entry point for the Express adapter.
 *
 * `ExpressFrameworkAdapter.configure()` returns a builder you pass to
 * `new Forge({ frameworkAdapter })`; `forge.getRouter()` then yields the Express
 * router. It is a thin wrapper over {@link createExpressRouter} — both styles
 * produce the same router, so use whichever you prefer:
 *
 * ```typescript
 * // builder style
 * const forge = new Forge({
 *   renderer: new NunjucksRenderer({ nunjucksEnv }),
 *   frameworkAdapter: ExpressFrameworkAdapter.configure(),
 * })
 * app.use(forge.getRouter() as express.Router)
 *
 * // direct style
 * const forge = new Forge({ renderer: new NunjucksRenderer({ nunjucksEnv }) }).registerPackage({ ... })
 * app.use(createExpressRouter(forge))
 * ```
 */
export const ExpressFrameworkAdapter = {
  configure(): ExpressForgeAdapter {
    return {
      build: (forge: Forge<string>) => createExpressRouter(forge),
    }
  },
}

import express from 'express'
import type nunjucks from 'nunjucks'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import ExpressHandlerFactory from './ExpressHandlerFactory'
import NunjucksRenderer from '../renderer/NunjucksRenderer'

/**
 * Options for {@link createExpressRouter}. Rendering options configure the
 * router's `NunjucksRenderer`; request dependencies connect native Express
 * capabilities to Forge function factories.
 */
export interface ExpressForgeRouterOptions<TRequestDependencies extends object = Record<string, never>> {
  /**
   * Nunjucks environment used to load and render page templates. Forge function
   * factories also receive it as the stable `nunjucksEnv` adapter dependency.
   */
  nunjucksEnv: nunjucks.Environment

  /**
   * Template used when neither the step nor its journey ancestors resolve a
   * `view.template`. The `.njk` extension is appended automatically when not
   * present.
   *
   * @default 'form-step'
   */
  defaultTemplate?: string

  /**
   * When true, the `blocks` array handed to page templates carries `{ html, block }`
   * entries pairing each rendered string with its `RenderBlock` data (id, variant,
   * block type, and evaluated properties including any authored `metadata`).
   * When false, `blocks` is plain rendered HTML strings.
   *
   * @default false
   */
  includeBlockData?: boolean

  /**
   * Resolves capabilities that exist only for one Express request. Direct and
   * thenable results are supported. Forge calls this once during request
   * context preparation before binding function evaluators and rejects keys
   * already supplied through package or adapter dependencies.
   */
  requestDependencies?: (request: express.Request) => TRequestDependencies | PromiseLike<TRequestDependencies>
}

export function createExpressRouter<TRequestDependencies extends object = Record<string, never>>(
  forge: Forge,
  options: ExpressForgeRouterOptions<TRequestDependencies>,
): express.Router {
  const logger = forge.getLogger()
  const router = express.Router({ mergeParams: true })
  const renderer = new NunjucksRenderer(options)
  const adapterDependencies = { nunjucksEnv: options.nunjucksEnv }

  forge.getTopology().routes.forEach(route => {
    const handler = ExpressHandlerFactory.create(
      forge,
      route,
      logger,
      renderer,
      adapterDependencies,
      options.requestDependencies,
    )

    route.methods.forEach(method => {
      if (method === 'GET') {
        router.get(route.templatePath, handler)
      } else {
        router.post(route.templatePath, handler)
      }
    })
  })

  return router
}

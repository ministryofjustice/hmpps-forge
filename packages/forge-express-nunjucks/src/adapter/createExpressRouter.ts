import express from 'express'
import type nunjucks from 'nunjucks'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import ExpressHandlerFactory from './ExpressHandlerFactory'
import NunjucksRenderer from '../renderer/NunjucksRenderer'

/**
 * Options for {@link createExpressRouter}. Passed through verbatim to the
 * `NunjucksRenderer` the router builds, so each mounted router gets its own
 * renderer configuration.
 */
export interface ExpressForgeRouterOptions {
  /**
   * Nunjucks environment used to load and render page templates. The same
   * environment is handed to components at render time via their `renderer`
   * parameter, so component templates and macros resolve against it too.
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
}

export function createExpressRouter(forge: Forge, options: ExpressForgeRouterOptions): express.Router {
  const logger = forge.getLogger()
  const router = express.Router({ mergeParams: true })
  const renderer = new NunjucksRenderer(options)

  forge.getTopology().routes.forEach(route => {
    const handler = ExpressHandlerFactory.create(forge, route, logger, renderer)

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

import express from 'express'
import type nunjucks from 'nunjucks'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import ExpressHandlerFactory from './ExpressHandlerFactory'
import NunjucksRenderer from '../renderer/NunjucksRenderer'

export interface ExpressForgeRouterOptions {
  /** Nunjucks environment for page template rendering. */
  nunjucksEnv: nunjucks.Environment

  /**
   * Default template to use when no template is specified in step or ancestors.
   * Defaults to 'form-step'. The .njk extension is appended automatically if not present.
   */
  defaultTemplate?: string
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

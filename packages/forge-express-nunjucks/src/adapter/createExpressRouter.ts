import express from 'express'
import type nunjucks from 'nunjucks'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import ExpressHandlerFactory from './ExpressHandlerFactory'
import NunjucksRenderer from '../renderer/NunjucksRenderer'

/**
 * Request body types a Forge POST route can accept, valued by the content type
 * each one matches.
 */
export enum RequestBodyType {
  FORM = 'application/x-www-form-urlencoded',
  JSON = 'application/json',
}

/**
 * Options for {@link createExpressRouter}. Passed through to the
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

  /**
   * Body types Forge POST routes accept. A POST with any other body type is
   * rejected with a 415 before Forge runs. Browsers only ever submit forms, so
   * the default suits any app whose steps are posted from rendered pages.
   *
   * Accepting `RequestBodyType.JSON` puts answer shapes in the hands of the
   * app's JSON parser, which bounds a body by size alone. Form bodies are also
   * capped by the urlencoded parser's parameter count and nesting depth, so a
   * JSON body can carry arrays and nesting that no form post could.
   *
   * @default [RequestBodyType.FORM]
   */
  acceptedBodyTypes?: RequestBodyType[]
}

export function createExpressRouter(forge: Forge, options: ExpressForgeRouterOptions): express.Router {
  const logger = forge.getLogger()
  const router = express.Router({ mergeParams: true })
  const renderer = new NunjucksRenderer(options)
  const bodyTypeGuard = ExpressHandlerFactory.createBodyTypeGuard(options.acceptedBodyTypes ?? [RequestBodyType.FORM])

  forge.getTopology().routes.forEach(route => {
    const handler = ExpressHandlerFactory.create(forge, route, logger, renderer)

    route.methods.forEach(method => {
      if (method === 'GET') {
        router.get(route.templatePath, handler)
      } else {
        router.post(route.templatePath, bodyTypeGuard, handler)
      }
    })
  })

  return router
}

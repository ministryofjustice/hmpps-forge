/**
 * forge-express-nunjucks
 *
 * Express.js and Nunjucks integration for forge.
 *
 * This package provides `createExpressRouter`, which builds an Express router
 * around a configured Forge instance — owning Express routing and Nunjucks page
 * rendering. The nunjucksEnv is passed to components at render time via the
 * `renderer` parameter.
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 * import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
 *
 * const nunjucksEnv = nunjucks.configure([...])
 *
 * const forge = new Forge({ logger })
 *   .registerGlobalComponents(govukComponents())
 *   .registerPackage(myPackage)
 *
 * app.use(createExpressRouter(forge, { nunjucksEnv }))
 * ```
 */

export { createExpressRouter } from './adapter/createExpressRouter'
export type { ExpressForgeRouterOptions } from './adapter/createExpressRouter'
export { ExpressFrameworkAdapter } from './adapter/ExpressFrameworkAdapter'
export type { ExpressForgeAdapter } from './adapter/ExpressFrameworkAdapter'
export { default as NunjucksRenderer } from './renderer/NunjucksRenderer'
export type { NunjucksRendererOptions } from './renderer/NunjucksRenderer'
export type { TemplateBlock } from './renderer/types'
export { buildNunjucksComponent } from './utils/buildNunjucksComponent'
export type { NunjucksComponentRenderer } from './utils/buildNunjucksComponent'
export { nunjucksComponent } from './utils/nunjucksComponent'

export { NunjucksGenerators, nunjucksFunctions } from './generators/nunjucksGenerators'

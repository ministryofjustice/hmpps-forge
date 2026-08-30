/**
 * forge-express-nunjucks
 *
 * Express.js and Nunjucks integration for forge.
 *
 * This package provides `createExpressRouter`, which builds an Express router
 * around a configured Forge instance — owning Express routing and Nunjucks page
 * rendering. The adapter supplies `nunjucksEnv` as a function dependency;
 * `nunjucksComponent()` makes it available to component factories alongside package
 * dependencies.
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 *
 * const nunjucksEnv = nunjucks.configure([...])
 *
 * const forge = new Forge({ logger }).registerPackage(myPackage)
 *
 * app.use(createExpressRouter(forge, {
 *   nunjucksEnv,
 *   requestDependencies: request => ({ authenticatedHttp: request.authenticatedHttp }),
 * }))
 * ```
 */

export { createExpressRouter } from './adapter/createExpressRouter'
export type { ExpressForgeRouterOptions } from './adapter/createExpressRouter'
export { default as NunjucksRenderer } from './renderer/NunjucksRenderer'
export type { NunjucksRendererOptions } from './renderer/NunjucksRenderer'
export type { TemplateBlock } from './renderer/types'
export { nunjucksComponent } from './utils/nunjucksComponent'

export { NunjucksGenerators } from './generators/nunjucksGenerators'

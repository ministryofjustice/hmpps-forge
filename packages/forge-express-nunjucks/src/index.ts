/**
 * forge-express-nunjucks
 *
 * Express.js and Nunjucks integration for forge, split into two concerns:
 * `NunjucksRenderer` is the rendering backend (driven block by block by a
 * `ForgeOrchestrator`), and `createExpressRouter` is the transport layer that
 * composes the orchestrator and renderer over your Forge engine, turns Express
 * requests into Forge snapshots, and writes outcomes back to the response. The
 * nunjucksEnv is passed to components at render time via the `renderer`
 * parameter.
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
export { default as NunjucksRenderer } from './renderer/NunjucksRenderer'
export type { NunjucksRendererOptions } from './renderer/NunjucksRenderer'
export type { ExpressForgeAdapter } from './adapter/ExpressFrameworkAdapter'
export { buildNunjucksComponent } from './utils/buildNunjucksComponent'
export type { NunjucksComponentRenderer } from './utils/buildNunjucksComponent'

export { NunjucksGenerators, nunjucksFunctions } from './generators/nunjucksGenerators'
export type { NunjucksGeneratorShape } from './generators/nunjucksGenerators'

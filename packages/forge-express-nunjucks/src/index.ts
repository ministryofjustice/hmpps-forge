/**
 * forge-express-nunjucks
 *
 * Express.js and Nunjucks integration for forge.
 *
 * This package provides ExpressFrameworkAdapter which handles Express routing
 * and Nunjucks page rendering. The nunjucksEnv is passed to components at
 * render time via the `renderer` parameter.
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 * import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
 *
 * const nunjucksEnv = nunjucks.configure([...])
 *
 * const forge = new Forge({
 *   logger,
 *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
 * })
 *   .registerGlobalComponents(govukComponents())
 *   .registerPackage(myPackage)
 * ```
 */

export { default as ExpressFrameworkAdapter } from './adapter/ExpressFrameworkAdapter'
export { buildNunjucksComponent } from './utils/buildNunjucksComponent'
export type { NunjucksComponentRenderer } from './utils/buildNunjucksComponent'

export { NunjucksGenerators, nunjucksFunctions } from './generators/nunjucksGenerators'
export type { NunjucksGeneratorShape } from './generators/nunjucksGenerators'

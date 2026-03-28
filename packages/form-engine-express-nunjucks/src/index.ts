/**
 * form-engine-express-nunjucks
 *
 * Express.js and Nunjucks integration for form-engine.
 *
 * This package provides ExpressFrameworkAdapter which handles Express routing
 * and Nunjucks page rendering. The nunjucksEnv is passed to components at
 * render time via the `renderer` parameter.
 *
 * @example
 * ```typescript
 * import { FormEngine } from 'hmpps-forge/core'
 * import { ExpressFrameworkAdapter } from 'hmpps-forge/express-nunjucks'
 * import { govukComponents } from 'hmpps-forge/govuk-components'
 *
 * const nunjucksEnv = nunjucks.configure([...])
 *
 * const formEngine = new FormEngine({
 *   logger,
 *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
 * })
 *   .registerComponents(govukComponents())
 *   .registerForm(myJourney)
 * ```
 */

export { default as ExpressFrameworkAdapter } from './adapter/ExpressFrameworkAdapter'
export { buildNunjucksComponent } from './utils/buildNunjucksComponent'
export type { NunjucksComponentRenderer } from './utils/buildNunjucksComponent'

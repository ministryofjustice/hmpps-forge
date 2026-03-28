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
 * import { FormEngine } from '@form-engine/core'
 * import { ExpressFrameworkAdapter } from '@form-engine-express-nunjucks'
 * import { govukComponents } from '@form-engine-govuk-components'
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

export { default as ExpressFrameworkAdapter } from '@form-engine-express-nunjucks/adapter/ExpressFrameworkAdapter'
export { buildNunjucksComponent } from '@form-engine-express-nunjucks/utils/buildNunjucksComponent'
export type { NunjucksComponentRenderer } from '@form-engine-express-nunjucks/utils/buildNunjucksComponent'

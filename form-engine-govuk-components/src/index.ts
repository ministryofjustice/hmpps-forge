/**
 * GOV.UK Frontend Components for Form Engine
 *
 * This package provides GOV.UK Design System components as form-engine compatible
 * components. Components receive the Nunjucks environment at render time from the
 * framework adapter.
 *
 * @example
 * ```typescript
 * import { FormEngine } from '@form-engine/core'
 * import { ExpressFrameworkAdapter } from '@form-engine-express-nunjucks'
 * import { govukComponents } from '@form-engine-govuk-components'
 *
 * const nunjucksEnv = nunjucksSetup(app)
 *
 * const formEngine = new FormEngine({
 *   logger,
 *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
 * })
 *   .registerComponents(govukComponents())
 *   .registerForm(myJourney)
 * ```
 */

export { govukComponents } from './components/index'
export { govukUtilityClasses } from './utils/govukUtilityClasses'

// Re-export types
export type {
  GovUKButton,
  GovUKLinkButton,
  GovUKTextInput,
  GovUKRadioInput,
  GovUKCheckboxInput,
  GovUKTextareaInput,
  GovUKCharacterCount,
  GovUKDateInputFull,
  GovUKDateInputYearMonth,
  GovUKDateInputMonthDay,
} from './components'

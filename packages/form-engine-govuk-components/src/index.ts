/**
 * GOV.UK Frontend Components for Form Engine
 *
 * This package provides GOV.UK Design System components as form-engine compatible
 * components. Components receive the Nunjucks environment at render time from the
 * framework adapter.
 *
 * @example
 * ```typescript
 * import { FormEngine } from 'hmpps-forge/core'
 * import { ExpressFrameworkAdapter } from 'hmpps-forge/express-nunjucks'
 * import { govukComponents } from 'hmpps-forge/govuk-components'
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
export { GovUKButtonGroup } from './wrappers/govukButtonGroup'
export { GovUKGridRow } from './wrappers/govukGridRow'
export { GovUKSectionBreak } from './wrappers/govukSectionBreak'
export { GovUKHeading } from './wrappers/govukHeading'
export { GovUKBody } from './wrappers/govukBody'
export { GovUKList } from './wrappers/govukList'
export type { GovUKButtonGroupProps } from './wrappers/govukButtonGroup'
export type { GovUKGridRowProps, GovUKGridColumn } from './wrappers/govukGridRow'
export type { GovUKSectionBreakProps } from './wrappers/govukSectionBreak'
export type { GovUKHeadingProps } from './wrappers/govukHeading'
export type { GovUKBodyProps } from './wrappers/govukBody'
export type { GovUKListProps } from './wrappers/govukList'

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

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
export { GovUKButtonGroup } from '@form-engine-govuk-components/wrappers/govukButtonGroup'
export { GovUKGridRow } from '@form-engine-govuk-components/wrappers/govukGridRow'
export { GovUKSectionBreak } from '@form-engine-govuk-components/wrappers/govukSectionBreak'
export { GovUKHeading } from '@form-engine-govuk-components/wrappers/govukHeading'
export { GovUKBody } from '@form-engine-govuk-components/wrappers/govukBody'
export { GovUKList } from '@form-engine-govuk-components/wrappers/govukList'
export type { GovUKButtonGroupProps } from '@form-engine-govuk-components/wrappers/govukButtonGroup'
export type { GovUKGridRowProps, GovUKGridColumn } from '@form-engine-govuk-components/wrappers/govukGridRow'
export type { GovUKSectionBreakProps } from '@form-engine-govuk-components/wrappers/govukSectionBreak'
export type { GovUKHeadingProps } from '@form-engine-govuk-components/wrappers/govukHeading'
export type { GovUKBodyProps } from '@form-engine-govuk-components/wrappers/govukBody'
export type { GovUKListProps } from '@form-engine-govuk-components/wrappers/govukList'

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

/**
 * GOV.UK Frontend Components for Forge
 *
 * This package provides GOV.UK Design System components as forge compatible
 * components. Components receive the Nunjucks environment at render time from the
 * framework adapter.
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 * import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
 *
 * const nunjucksEnv = nunjucksSetup(app)
 *
 * const forge = new Forge({
 *   logger,
 *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
 * })
 *   .registerGlobalComponents(govukComponents())
 *   .register(myJourney)
 * ```
 */

export { govukComponents } from './components/index'
export { GovUKUtilityClasses } from './utils/govukUtilityClasses'
export { GovUKValidations } from './utils/govukValidations'
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

// Re-export component wrapper functions and types
export {
  GovUKAccordion,
  GovUKBackLink,
  GovUKBreadcrumbs,
  GovUKButton,
  GovUKLinkButton,
  GovUKTextInput,
  GovUKPasswordInput,
  GovUKSelectInput,
  GovUKRadioInput,
  GovUKCheckboxInput,
  GovUKTextareaInput,
  GovUKCharacterCount,
  GovUKDateInputFull,
  GovUKDateInputYearMonth,
  GovUKDateInputMonthDay,
  GovUKDetails,
  GovUKExitThisPage,
  GovUKInsetText,
  GovUKNotificationBanner,
  GovUKPagination,
  GovUKPanel,
  GovUKSummaryList,
  GovUKTable,
  GovUKTabs,
  GovUKTag,
  GovUKTaskList,
  GovUKWarningText,
} from './components'

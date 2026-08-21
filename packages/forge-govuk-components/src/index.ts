/**
 * GOV.UK Frontend Components for Forge
 *
 * This package provides GOV.UK Design System components as forge compatible
 * components. Components receive the Nunjucks environment at render time from the
 * framework adapter.
 *
 * Building a block with a component in a journey registers it for that
 * package automatically. The `govukComponents` array exists for journeys
 * that reference variants by string only (a JSON journey, for example) -
 * list it on the package's `components` property.
 */

export { govukComponents } from './components/index'
export { GovUKUtilityClasses } from './utils/govukUtilityClasses'
export { GovUKValidations } from './utils/govukValidations'
export { registerForgeGovUKComponentsGlobals } from './utils/registerForgeGovUKComponentsGlobals'
export type { GovUKGridColumn } from './components'

// Re-export component wrapper functions and types
export {
  GovUKAccordion,
  GovUKBackLink,
  GovUKBody,
  GovUKBreadcrumbs,
  GovUKButton,
  GovUKLinkButton,
  GovUKButtonGroup,
  GovUKGridRow,
  GovUKHeading,
  GovUKList,
  GovUKSectionBreak,
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

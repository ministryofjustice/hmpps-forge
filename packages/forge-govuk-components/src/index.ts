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
 * import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 * import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
 *
 * const nunjucksEnv = nunjucksSetup(app)
 *
 * const forge = new Forge({ logger })
 *   .registerGlobalComponents(govukComponents())
 *   .registerPackage(myPackage)
 *
 * app.use(createExpressRouter(forge, { nunjucksEnv }))
 * ```
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

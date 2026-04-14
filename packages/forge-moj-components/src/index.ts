/**
 * MOJ Frontend Components for Forge
 *
 * This package provides Ministry of Justice Design Pattern components as
 * forge compatible components. Components render HTML directly based
 * on the MOJ Design Patterns specifications.
 *
 * @see https://design-patterns.service.justice.gov.uk/
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 * import { mojComponents } from '@ministryofjustice/hmpps-forge/moj-components'
 *
 * const forge = new Forge({
 *   logger,
 *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
 * })
 *   .registerGlobalComponents(mojComponents)
 *   .register(myJourney)
 * ```
 */

export { mojComponents } from './components/index'

// Re-export wrapper functions (each also exports its interface type)
export {
  MOJAlert,
  MOJBadge,
  MOJBanner,
  MOJButtonMenu,
  MOJCard,
  MOJCardGroup,
  MOJDatePicker,
  MOJFilter,
  MOJProgressBar,
  MOJSideNavigation,
  MOJSubNavigation,
  MOJTicketPanel,
  MOJTimeline,
  MOJMessages,
  MOJMultiSelect,
  MOJSortableTable,
} from './components'

// Re-export supporting types
export type {
  MOJCardHeading,
  MOJCardDescription,
  MOJCardGroupItem,
  MOJCardGroupItemHeading,
  MOJCardGroupItemDescription,
  MOJDatePickerLabel,
  MOJDatePickerHint,
  MOJDatePickerFormGroup,
} from './components'

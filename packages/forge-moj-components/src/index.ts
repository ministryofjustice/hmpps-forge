/**
 * MOJ Frontend Components for Forge
 *
 * This package provides Ministry of Justice Design Pattern components as
 * forge compatible components. Components render HTML directly based
 * on the MOJ Design Patterns specifications.
 *
 * @see https://design-patterns.service.justice.gov.uk/
 *
 * Building a block with a component in a journey registers it for that
 * package automatically. The `mojComponents` array exists for journeys
 * that reference variants by string only (a JSON journey, for example) -
 * list it on the package's `components` property.
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

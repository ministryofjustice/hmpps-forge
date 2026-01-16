import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

import { mojAlert } from './alert/mojAlert'
import { mojBadge } from './badge/mojBadge'
import { mojBanner } from './banner/mojBanner'
import { mojButtonMenu } from './button-menu/mojButtonMenu'
import { mojCard } from './card/mojCard'
import { mojCardGroup } from './card-group/mojCardGroup'
import { mojDatePicker } from './date-picker/mojDatePicker'
import { mojFilter } from './filter/mojFilter'
import { mojProgressBar } from './progress-bar/mojProgressBar'
import { mojSideNavigation } from './side-navigation/mojSideNavigation'
import { mojSubNavigation } from './sub-navigation/mojSubNavigation'
import { mojTicketPanel } from './ticket-panel/mojTicketPanel'
import { mojTimeline } from './timeline/mojTimeline'
import { mojMessages } from './messages/mojMessages'
import { mojMultiSelect } from './multi-select/mojMultiSelect'
import { mojSortableTable } from './sortable-table/mojSortableTable'

// Re-export types only (for types that don't have wrapper functions)
export type { MOJAlertVariant, MOJAlertHeadingTag } from './alert/mojAlert'
export type { MOJBadgeColour } from './badge/mojBadge'
export type { MOJBannerType } from './banner/mojBanner'
export type { MOJButtonMenuAlign, MOJButtonMenuButton, MOJButtonMenuItem } from './button-menu/mojButtonMenu'
export type { MOJCardHeading, MOJCardDescription } from './card/mojCard'
export type { MOJCardGroupItem, MOJCardGroupItemHeading, MOJCardGroupItemDescription } from './card-group/mojCardGroup'
export type { MOJDatePickerLabel, MOJDatePickerHint, MOJDatePickerFormGroup } from './date-picker/mojDatePicker'
export type {
  MOJFilterHeading,
  MOJFilterClearLink,
  MOJFilterTagItem,
  MOJFilterCategory,
  MOJFilterSelectedFilters,
  MOJFilterSubmit,
} from './filter/mojFilter'
export type { MOJProgressBarItem, MOJProgressBarItemLabel } from './progress-bar/mojProgressBar'
export type {
  MOJSideNavigationItem,
  MOJSideNavigationSection,
  MOJSideNavigationHeading,
} from './side-navigation/mojSideNavigation'
export type { MOJSubNavigationItem } from './sub-navigation/mojSubNavigation'
export type { MOJTicketPanelItem, MOJTicketPanelColor } from './ticket-panel/mojTicketPanel'
export type {
  MOJTimelineItem,
  MOJTimelineItemLabel,
  MOJTimelineItemDatetime,
  MOJTimelineItemByline,
} from './timeline/mojTimeline'
export type { MOJMessageItem, MOJMessageType } from './messages/mojMessages'
export type { MultiSelectHeadCell, MultiSelectCell, MultiSelectRow } from './multi-select/mojMultiSelect'
export type { SortableTableHeadCell, SortableTableCell, SortableTableRow } from './sortable-table/mojSortableTable'

// Re-export wrapper functions (types are exported implicitly with the functions)
export { MOJAlert } from './alert/mojAlert'
export { MOJBadge } from './badge/mojBadge'
export { MOJBanner } from './banner/mojBanner'
export { MOJButtonMenu } from './button-menu/mojButtonMenu'
export { MOJCard } from './card/mojCard'
export { MOJCardGroup } from './card-group/mojCardGroup'
export { MOJDatePicker } from './date-picker/mojDatePicker'
export { MOJFilter } from './filter/mojFilter'
export { MOJProgressBar } from './progress-bar/mojProgressBar'
export { MOJSideNavigation } from './side-navigation/mojSideNavigation'
export { MOJSubNavigation } from './sub-navigation/mojSubNavigation'
export { MOJTicketPanel } from './ticket-panel/mojTicketPanel'
export { MOJTimeline } from './timeline/mojTimeline'
export { MOJMessages } from './messages/mojMessages'
export { MOJMultiSelect } from './multi-select/mojMultiSelect'
export { MOJSortableTable } from './sortable-table/mojSortableTable'

/** All MOJ component definitions */
export const mojComponents: ComponentRegistryEntry<any>[] = [
  mojAlert,
  mojBadge,
  mojBanner,
  mojButtonMenu,
  mojCard,
  mojCardGroup,
  mojDatePicker,
  mojFilter,
  mojProgressBar,
  mojSideNavigation,
  mojSubNavigation,
  mojTicketPanel,
  mojTimeline,
  mojMessages,
  mojMultiSelect,
  mojSortableTable,
]

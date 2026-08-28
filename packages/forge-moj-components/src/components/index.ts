import { ComponentRegistryEntry } from '@ministryofjustice/hmpps-forge/core/components'

import { MOJAlert } from './alert/mojAlert'
import { MOJBadge } from './badge/mojBadge'
import { MOJBanner } from './banner/mojBanner'
import { MOJButtonMenu } from './button-menu/mojButtonMenu'
import { MOJCard } from './card/mojCard'
import { MOJCardGroup } from './card-group/mojCardGroup'
import { MOJDatePicker } from './date-picker/mojDatePicker'
import { MOJFilter } from './filter/mojFilter'
import { MOJProgressBar } from './progress-bar/mojProgressBar'
import { MOJSideNavigation } from './side-navigation/mojSideNavigation'
import { MOJSubNavigation } from './sub-navigation/mojSubNavigation'
import { MOJTicketPanel } from './ticket-panel/mojTicketPanel'
import { MOJTimeline } from './timeline/mojTimeline'
import { MOJMessages } from './messages/mojMessages'
import { MOJMultiSelect } from './multi-select/mojMultiSelect'
import { MOJSortableTable } from './sortable-table/mojSortableTable'

// Re-export supporting types
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

// Re-export the components (each const is both the block builder and the registry entry)
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
export const mojComponents: ComponentRegistryEntry<object, string>[] = [
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
]

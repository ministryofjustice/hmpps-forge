import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

import { mojAlert } from './alert/mojAlert'
import { mojCard } from './card/mojCard'
import { mojCardGroup } from './card-group/mojCardGroup'
import { mojDatePicker } from './date-picker/mojDatePicker'
import { mojSideNavigation } from './side-navigation/mojSideNavigation'
import { mojSubNavigation } from './sub-navigation/mojSubNavigation'

// Re-export types only (for types that don't have wrapper functions)
export type { MOJAlertVariant, MOJAlertHeadingTag } from './alert/mojAlert'
export type { MOJCardHeading, MOJCardDescription } from './card/mojCard'
export type { MOJCardGroupItem, MOJCardGroupItemHeading, MOJCardGroupItemDescription } from './card-group/mojCardGroup'
export type { MOJDatePickerLabel, MOJDatePickerHint, MOJDatePickerFormGroup } from './date-picker/mojDatePicker'
export type {
  MOJSideNavigationItem,
  MOJSideNavigationSection,
  MOJSideNavigationHeading,
} from './side-navigation/mojSideNavigation'
export type { MOJSubNavigation, MOJSubNavigationItem } from './sub-navigation/mojSubNavigation'

// Re-export wrapper functions (types are exported implicitly with the functions)
export { MOJAlert } from './alert/mojAlert'
export { MOJCard } from './card/mojCard'
export { MOJCardGroup } from './card-group/mojCardGroup'
export { MOJDatePicker } from './date-picker/mojDatePicker'
export { MOJSideNavigation } from './side-navigation/mojSideNavigation'

/** All MOJ component definitions */
export const mojComponents: ComponentRegistryEntry<any>[] = [
  mojAlert,
  mojCard,
  mojCardGroup,
  mojDatePicker,
  mojSideNavigation,
  mojSubNavigation,
]

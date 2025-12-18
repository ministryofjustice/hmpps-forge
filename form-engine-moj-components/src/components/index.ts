import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

import { mojCard } from './card/mojCard'
import { mojCardGroup } from './card-group/mojCardGroup'
import { mojDatePicker } from './date-picker/mojDatePicker'
import { mojSideNavigation } from './side-navigation/mojSideNavigation'

// Re-export types for consumers
export type { MOJCard, MOJCardHeading, MOJCardDescription } from './card/mojCard'
export type {
  MOJCardGroup,
  MOJCardGroupItem,
  MOJCardGroupItemHeading,
  MOJCardGroupItemDescription,
} from './card-group/mojCardGroup'
export type {
  MOJDatePicker,
  MOJDatePickerLabel,
  MOJDatePickerHint,
  MOJDatePickerFormGroup,
} from './date-picker/mojDatePicker'
export type {
  MOJSideNavigation,
  MOJSideNavigationItem,
  MOJSideNavigationSection,
  MOJSideNavigationHeading,
} from './side-navigation/mojSideNavigation'

/** All MOJ component definitions */
export const mojComponents: ComponentRegistryEntry<any>[] = [mojCard, mojCardGroup, mojDatePicker, mojSideNavigation]

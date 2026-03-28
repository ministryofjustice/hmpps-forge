import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

import { govukAccordion } from './accordion/govukAccordion'
import { govukBackLink } from './back-link/govukBackLink'
import { govukBreadcrumbs } from './breadcrumbs/govukBreadcrumbs'
import { govukButton, govukLinkButton } from './button/govukButton'
import { govukTextInput } from './text-input/govukTextInput'
import { govukPasswordInput } from './password-input/govukPasswordInput'
import { govukSelectInput } from './select-input/govukSelectInput'
import { govukRadioInput } from './radio-input/govukRadioInput'
import { govukCheckboxInput } from './checkbox-input/govukCheckboxInput'
import { govukTextareaInput } from './textarea-input/govukTextareaInput'
import { govukCharacterCount } from './character-count/govukCharacterCount'
import {
  govukDateInputFull,
  govukDateInputYearMonth,
  govukDateInputMonthDay,
} from './date-input/govukDateInputVariants'
import { govukDetails } from './details/govukDetails'
import { govukExitThisPage } from './exit-this-page/govukExitThisPage'
import { govukInsetText } from './inset-text/govukInsetText'
import { govukNotificationBanner } from './notification-banner/govukNotificationBanner'
import { govukPagination } from './pagination/govukPagination'
import { govukPanel } from './panel/govukPanel'
import { govukSummaryList } from './summary-list/govukSummaryList'
import { govukTable } from './table/govukTable'
import { govukTabs } from './tabs/govukTabs'
import { govukTag } from './tag/govukTag'
import { govukTaskList } from './task-list/govukTaskList'
import { govukWarningText } from './warning-text/govukWarningText'

// Re-export types only (for types that don't have wrapper functions)
export type {
  AccordionItemHeading,
  AccordionItemSummary,
  AccordionItemContent,
  AccordionItem,
} from './accordion/govukAccordion'
export type { BreadcrumbItem } from './breadcrumbs/govukBreadcrumbs'
export type { SelectItem } from './select-input/govukSelectInput'
export type { PaginationLink, PaginationItem } from './pagination/govukPagination'
export type {
  SummaryListActionItem,
  SummaryListActions,
  SummaryListKey,
  SummaryListValue,
  SummaryListRow,
  SummaryCardTitle,
  SummaryCard,
} from './summary-list/govukSummaryList'
export type { TableHeadCell, TableCell, TableRow } from './table/govukTable'
export type { TabPanel, TabItem } from './tabs/govukTabs'
export type {
  TaskListStatusTag,
  TaskListStatus,
  TaskListTitle,
  TaskListHint,
  TaskListItem,
} from './task-list/govukTaskList'

// Re-export wrapper functions (types are exported implicitly with the functions)
export { GovUKAccordion } from './accordion/govukAccordion'
export { GovUKBackLink } from './back-link/govukBackLink'
export { GovUKBreadcrumbs } from './breadcrumbs/govukBreadcrumbs'
export { GovUKButton, GovUKLinkButton } from './button/govukButton'
export { GovUKTextInput } from './text-input/govukTextInput'
export { GovUKPasswordInput } from './password-input/govukPasswordInput'
export { GovUKSelectInput } from './select-input/govukSelectInput'
export { GovUKRadioInput } from './radio-input/govukRadioInput'
export { GovUKCheckboxInput } from './checkbox-input/govukCheckboxInput'
export { GovUKTextareaInput } from './textarea-input/govukTextareaInput'
export { GovUKCharacterCount } from './character-count/govukCharacterCount'
export {
  GovUKDateInputFull,
  GovUKDateInputYearMonth,
  GovUKDateInputMonthDay,
} from './date-input/govukDateInputVariants'
export { GovUKDetails } from './details/govukDetails'
export { GovUKExitThisPage } from './exit-this-page/govukExitThisPage'
export { GovUKInsetText } from './inset-text/govukInsetText'
export { GovUKNotificationBanner } from './notification-banner/govukNotificationBanner'
export { GovUKPagination } from './pagination/govukPagination'
export { GovUKPanel } from './panel/govukPanel'
export { GovUKSummaryList } from './summary-list/govukSummaryList'
export { GovUKTable } from './table/govukTable'
export { GovUKTabs } from './tabs/govukTabs'
export { GovUKTag } from './tag/govukTag'
export { GovUKTaskList } from './task-list/govukTaskList'
export { GovUKWarningText } from './warning-text/govukWarningText'

/** All GOV.UK component definitions */
export const govukComponents: ComponentRegistryEntry<any>[] = [
  govukAccordion,
  govukBackLink,
  govukBreadcrumbs,
  govukButton,
  govukLinkButton,
  govukTextInput,
  govukPasswordInput,
  govukSelectInput,
  govukRadioInput,
  govukCheckboxInput,
  govukTextareaInput,
  govukCharacterCount,
  govukDateInputFull,
  govukDateInputYearMonth,
  govukDateInputMonthDay,
  govukDetails,
  govukExitThisPage,
  govukInsetText,
  govukNotificationBanner,
  govukPagination,
  govukPanel,
  govukSummaryList,
  govukTable,
  govukTabs,
  govukTag,
  govukTaskList,
  govukWarningText,
]

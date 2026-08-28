import { ComponentRegistryEntry } from '@ministryofjustice/hmpps-forge/core/components'

import { GovUKAccordion } from './accordion/govukAccordion'
import { GovUKBackLink } from './back-link/govukBackLink'
import { GovUKBody } from './body/govukBody'
import { GovUKBreadcrumbs } from './breadcrumbs/govukBreadcrumbs'
import { GovUKButton, GovUKLinkButton } from './button/govukButton'
import { GovUKButtonGroup } from './button-group/govukButtonGroup'
import { GovUKGridRow } from './grid-row/govukGridRow'
import { GovUKHeading } from './heading/govukHeading'
import { GovUKList } from './list/govukList'
import { GovUKSectionBreak } from './section-break/govukSectionBreak'
import { GovUKTextInput } from './text-input/govukTextInput'
import { GovUKPasswordInput } from './password-input/govukPasswordInput'
import { GovUKSelectInput } from './select-input/govukSelectInput'
import { GovUKRadioInput } from './radio-input/govukRadioInput'
import { GovUKCheckboxInput } from './checkbox-input/govukCheckboxInput'
import { GovUKTextareaInput } from './textarea-input/govukTextareaInput'
import { GovUKCharacterCount } from './character-count/govukCharacterCount'
import {
  GovUKDateInputFull,
  GovUKDateInputYearMonth,
  GovUKDateInputMonthDay,
} from './date-input/govukDateInputVariants'
import { GovUKDetails } from './details/govukDetails'
import { GovUKExitThisPage } from './exit-this-page/govukExitThisPage'
import { GovUKInsetText } from './inset-text/govukInsetText'
import { GovUKNotificationBanner } from './notification-banner/govukNotificationBanner'
import { GovUKPagination } from './pagination/govukPagination'
import { GovUKPanel } from './panel/govukPanel'
import { GovUKSummaryList } from './summary-list/govukSummaryList'
import { GovUKTable } from './table/govukTable'
import { GovUKTabs } from './tabs/govukTabs'
import { GovUKTag } from './tag/govukTag'
import { GovUKTaskList } from './task-list/govukTaskList'
import { GovUKWarningText } from './warning-text/govukWarningText'

// Re-export supporting types
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

// Re-export the components (each const is both the block builder and the registry entry)
export { GovUKAccordion } from './accordion/govukAccordion'
export { GovUKBackLink } from './back-link/govukBackLink'
export { GovUKBody } from './body/govukBody'
export { GovUKBreadcrumbs } from './breadcrumbs/govukBreadcrumbs'
export { GovUKButton, GovUKLinkButton } from './button/govukButton'
export { GovUKButtonGroup } from './button-group/govukButtonGroup'
export { GovUKGridRow } from './grid-row/govukGridRow'
export type { GovUKGridColumn } from './grid-row/govukGridRow'
export { GovUKHeading } from './heading/govukHeading'
export { GovUKList } from './list/govukList'
export { GovUKSectionBreak } from './section-break/govukSectionBreak'
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
export const govukComponents: ComponentRegistryEntry<object, string>[] = [
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
]

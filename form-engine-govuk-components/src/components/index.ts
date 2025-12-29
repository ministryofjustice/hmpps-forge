import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

import { govukButton, govukLinkButton } from './button/govukButton'
import { govukTextInput } from './text-input/govukTextInput'
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
import { govukPagination } from './pagination/govukPagination'
import { govukWarningText } from './warning-text/govukWarningText'

// Re-export types for consumers
export type { SelectItem } from './select-input/govukSelectInput'
export type { PaginationLink, PaginationItem } from './pagination/govukPagination'

// Re-export wrapper functions (types are exported implicitly with the functions)
export { GovUKButton, GovUKLinkButton } from './button/govukButton'
export { GovUKTextInput } from './text-input/govukTextInput'
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
export { GovUKPagination } from './pagination/govukPagination'
export { GovUKWarningText } from './warning-text/govukWarningText'

/** All GOV.UK component definitions */
export const govukComponents: ComponentRegistryEntry<any>[] = [
  govukButton,
  govukLinkButton,
  govukTextInput,
  govukSelectInput,
  govukRadioInput,
  govukCheckboxInput,
  govukTextareaInput,
  govukCharacterCount,
  govukDateInputFull,
  govukDateInputYearMonth,
  govukDateInputMonthDay,
  govukDetails,
  govukPagination,
  govukWarningText,
]

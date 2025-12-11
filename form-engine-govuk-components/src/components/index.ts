import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

import { govukButton, govukLinkButton } from './button/govukButton'
import { govukTextInput } from './text-input/govukTextInput'
import { govukRadioInput } from './radio-input/govukRadioInput'
import { govukCheckboxInput } from './checkbox-input/govukCheckboxInput'
import { govukTextareaInput } from './textarea-input/govukTextareaInput'
import { govukCharacterCount } from './character-count/govukCharacterCount'
import {
  govukDateInputFull,
  govukDateInputYearMonth,
  govukDateInputMonthDay,
} from './date-input/govukDateInputVariants'

// Re-export types for consumers
export type { GovUKButton, GovUKLinkButton } from './button/govukButton'
export type { GovUKTextInput } from './text-input/govukTextInput'
export type { GovUKRadioInput } from './radio-input/govukRadioInput'
export type { GovUKCheckboxInput } from './checkbox-input/govukCheckboxInput'
export type { GovukTextareaInput } from './textarea-input/govukTextareaInput'
export type { GovUKCharacterCount } from './character-count/govukCharacterCount'
export type {
  GovUKDateInputFull,
  GovUKDateInputYearMonth,
  GovUKDateInputMonthDay,
} from './date-input/govukDateInputVariants'

/** All GOV.UK component definitions */
export const govukComponents: ComponentRegistryEntry<any>[] = [
  govukButton,
  govukLinkButton,
  govukTextInput,
  govukRadioInput,
  govukCheckboxInput,
  govukTextareaInput,
  govukCharacterCount,
  govukDateInputFull,
  govukDateInputYearMonth,
  govukDateInputMonthDay,
]

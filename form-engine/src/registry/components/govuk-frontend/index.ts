/**
 * All GovUK components as an array for bulk registration
 */
import { govukButton } from './button/govukButton'
import { govukCharacterCount } from './character-count/govukCharacterCount'
import { govukCheckboxInput } from './checkbox-input/govukCheckboxInput'
import {
  govukDateInputFull,
  govukDateInputYearMonth,
  govukDateInputMonthDay,
} from './date-input/govukDateInputVariants'
import { govukRadioInput } from './radio-input/govukRadioInput'
import { govukTextInput } from './text-input/govukTextInput'
import { govukTextareaInput } from './textarea-input/govukTextareaInput'

export const govukFrontendComponents = [
  govukButton,
  govukCharacterCount,
  govukCheckboxInput,
  govukDateInputFull,
  govukDateInputYearMonth,
  govukDateInputMonthDay,
  govukRadioInput,
  govukTextInput,
  govukTextareaInput,
]

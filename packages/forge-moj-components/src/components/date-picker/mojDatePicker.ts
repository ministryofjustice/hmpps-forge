import { z } from 'zod'
import { ResolvableFieldProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Label configuration for the MOJ Date Picker component.
 */
export interface MOJDatePickerLabel {
  /** Label text (required if html not set) */
  text?: string

  /** Label HTML content (required if text not set) */
  html?: string

  /** Additional classes for the label element */
  classes?: string

  /** Whether the label should be visually hidden */
  isPageHeading?: boolean

  /** HTML attributes for the label */
  attributes?: Record<string, string>
}

/**
 * Hint configuration for the MOJ Date Picker component.
 */
export interface MOJDatePickerHint {
  /** Hint text (required if html not set) */
  text?: string

  /** Hint HTML content (required if text not set) */
  html?: string

  /** Additional classes for the hint element */
  classes?: string

  /** HTML attributes for the hint */
  attributes?: Record<string, string>
}

/**
 * Form group configuration for the MOJ Date Picker component.
 */
export interface MOJDatePickerFormGroup {
  /** Additional classes for the form group */
  classes?: string

  /** HTML attributes for the form group */
  attributes?: Record<string, string>
}

/**
 * MOJ Date Picker component.
 * A date input component with calendar widget following the MOJ Design Patterns.
 *
 * The date picker allows users to select a date via calendar or direct text entry.
 * It enhances a standard text input with a calendar button that opens a date picker.
 * Date format is dd/mm/yyyy.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/date-picker/
 * @example
 * ```typescript
 * MOJDatePicker({
 *   code: 'appointment_date',
 *   label: 'Appointment date',
 *   hint: 'For example, 17/5/2024',
 *   minDate: '01/04/2025',
 *   maxDate: '30/04/2025',
 * })
 * ```
 */
export type MOJDatePicker = ResolvableFieldProps<{
  /**
   * The ID of the input. Defaults to the value of `code` if not provided.
   * @example 'appointment-date'
   */
  id?: string

  /**
   * Label for the date picker - can be a simple string or object with additional options.
   * @example 'Select a date'
   * @example { text: 'Select a date', classes: 'govuk-label--l' }
   */
  label: string | MOJDatePickerLabel

  /**
   * Optional hint text - can be a simple string or object with additional options.
   * @example 'For example, 17/5/2024'
   * @example { html: 'Enter the date in <strong>dd/mm/yyyy</strong> format' }
   */
  hint?: string | MOJDatePickerHint

  /**
   * Earliest date that can be selected (format: dd/mm/yyyy).
   * Users can still type dates before this, so server-side validation is required.
   * @example '01/04/2025'
   */
  minDate?: string

  /**
   * Latest date that can be selected (format: dd/mm/yyyy).
   * Users can still type dates after this, so server-side validation is required.
   * @example '30/04/2025'
   */
  maxDate?: string

  /**
   * Array of dates that cannot be selected (format: dd/mm/yyyy).
   * Users can still type these dates, so server-side validation is required.
   * @example ['02/04/2025', '18/04/2025']
   */
  excludedDates?: string[]

  /**
   * Array of days of the week that cannot be selected.
   * Users can still type these days, so server-side validation is required.
   * @example ['saturday', 'sunday']
   */
  excludedDays?: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[]

  /**
   * Which day the calendar week starts on.
   * @default 'monday'
   */
  weekStartDay?: 'monday' | 'sunday'

  /** Form group configuration */
  formGroup?: MOJDatePickerFormGroup

  /** Additional CSS classes for the date picker container */
  classes?: string

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}>

/**
 * Converts an ISO date string (YYYY-MM-DD) to UK format (DD/MM/YYYY).
 * If the value is already in UK format or not a valid date string, returns as-is.
 */
function toUKDateFormat(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined
  }

  // Check if it's ISO format (YYYY-MM-DD)
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }

  // Already UK format or other string - return as-is
  return value
}

/**
 * MOJ Date Picker component.
 * A date input component with calendar widget following the MOJ Design Patterns.
 *
 * The date picker allows users to select a date via calendar or direct text entry.
 * It enhances a standard text input with a calendar button that opens a date picker.
 * Date format is dd/mm/yyyy.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/date-picker/
 * @example
 * ```typescript
 * MOJDatePicker({
 *   code: 'appointment_date',
 *   label: 'Appointment date',
 *   hint: 'For example, 17/5/2024',
 *   minDate: '01/04/2025',
 *   maxDate: '30/04/2025',
 * })
 * ```
 */
export const MOJDatePicker = nunjucksComponent<MOJDatePicker>('mojDatePicker', {
  field: true,
  inputSchema: z.string(),
  // The rendered input's id matches the render params below, so error summary links land on it.
  errorAnchor: props => props.id ?? props.code,
  render: (props, nunjucksEnv) => {
    const params = {
      id: props.id ?? props.code,
      name: props.code,
      value: toUKDateFormat(props.value),
      label: typeof props.label === 'object' ? props.label : { text: props.label },
      hint: props.hint ? (typeof props.hint === 'object' ? props.hint : { text: props.hint }) : undefined,
      errorMessage: props.errors?.length ? { text: props.errors[0].message } : undefined,
      minDate: props.minDate,
      maxDate: props.maxDate,
      excludedDates: props.excludedDates?.join(' '),
      excludedDays: props.excludedDays?.join(' '),
      weekStartDay: props.weekStartDay,
      formGroup: props.formGroup,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/date-picker/template.njk', { params })
  },
})

import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  FieldBlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'

/**
 * Label configuration for the MOJ Date Picker component.
 */
export interface MOJDatePickerLabel {
  /** Label text (required if html not set) */
  text?: ConditionalString

  /** Label HTML content (required if text not set) */
  html?: ConditionalString

  /** Additional classes for the label element */
  classes?: ConditionalString

  /** Whether the label should be visually hidden */
  isPageHeading?: ConditionalBoolean

  /** HTML attributes for the label */
  attributes?: Record<string, string>
}

/**
 * Hint configuration for the MOJ Date Picker component.
 */
export interface MOJDatePickerHint {
  /** Hint text (required if html not set) */
  text?: ConditionalString

  /** Hint HTML content (required if text not set) */
  html?: ConditionalString

  /** Additional classes for the hint element */
  classes?: ConditionalString

  /** HTML attributes for the hint */
  attributes?: Record<string, string>
}

/**
 * Form group configuration for the MOJ Date Picker component.
 */
export interface MOJDatePickerFormGroup {
  /** Additional classes for the form group */
  classes?: ConditionalString

  /** HTML attributes for the form group */
  attributes?: Record<string, string>
}

/**
 * MOJ Date Picker component for selecting dates using a calendar widget.
 *
 * Based on the MOJ Design Patterns date picker component:
 * https://design-patterns.service.justice.gov.uk/components/date-picker/
 *
 * The date picker allows users to select a date via calendar or direct text entry.
 * It enhances a standard text input with a calendar button that opens a date picker.
 *
 * Date format is dd/mm/yyyy.
 *
 * @example
 * ```typescript
 * // Simple form - minimal configuration
 * field<MOJDatePicker>({
 *   variant: 'mojDatePicker',
 *   code: 'appointment_date',
 *   label: 'Appointment date',
 *   hint: 'For example, 17/5/2024',
 * })
 *
 * // Full form - with date restrictions
 * field<MOJDatePicker>({
 *   variant: 'mojDatePicker',
 *   code: 'booking_date',
 *   label: { text: 'Select a booking date', classes: 'govuk-label--l' },
 *   hint: { text: 'Only weekdays in April 2025 are available' },
 *   minDate: '01/04/2025',
 *   maxDate: '30/04/2025',
 *   excludedDays: ['saturday', 'sunday'],
 * })
 * ```
 */
export interface MOJDatePicker extends FieldBlockDefinition {
  variant: 'mojDatePicker'

  /**
   * The ID of the input. Defaults to the value of `code` if not provided.
   * @example 'appointment-date'
   */
  id?: ConditionalString

  /**
   * Label for the date picker - can be a simple string or object with additional options.
   * @example 'Select a date'
   * @example { text: 'Select a date', classes: 'govuk-label--l' }
   */
  label: ConditionalString | MOJDatePickerLabel

  /**
   * Optional hint text - can be a simple string or object with additional options.
   * @example 'For example, 17/5/2024'
   * @example { html: 'Enter the date in <strong>dd/mm/yyyy</strong> format' }
   */
  hint?: ConditionalString | MOJDatePickerHint

  /**
   * Earliest date that can be selected (format: dd/mm/yyyy).
   * Users can still type dates before this, so server-side validation is required.
   * @example '01/04/2025'
   */
  minDate?: ConditionalString

  /**
   * Latest date that can be selected (format: dd/mm/yyyy).
   * Users can still type dates after this, so server-side validation is required.
   * @example '30/04/2025'
   */
  maxDate?: ConditionalString

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
  classes?: ConditionalString

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

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
 * Renders an MOJ Date Picker component using Nunjucks template
 */
async function datePickerRenderer(
  block: EvaluatedBlock<MOJDatePicker>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    id: block.id ?? block.code,
    name: block.code,
    value: toUKDateFormat(block.value),
    label: typeof block.label === 'object' ? block.label : { text: block.label },
    hint: block.hint ? (typeof block.hint === 'object' ? block.hint : { text: block.hint }) : undefined,
    errorMessage: block.errors?.length ? { text: block.errors[0].message } : undefined,
    minDate: block.minDate,
    maxDate: block.maxDate,
    excludedDates: block.excludedDates?.join(' '),
    excludedDays: block.excludedDays?.join(' '),
    weekStartDay: block.weekStartDay,
    formGroup: block.formGroup,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/date-picker/template.njk', { params })
}

export const mojDatePicker = buildNunjucksComponent<MOJDatePicker>('mojDatePicker', datePickerRenderer)

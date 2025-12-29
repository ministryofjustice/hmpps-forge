import {
  ConditionalBoolean,
  ConditionalString,
  EvaluatedBlock,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@form-engine/form/types/structures.type'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import { field as fieldBuilder } from '@form-engine/form/builders'

/**
 * Props for GOV.UK Date Input Components.
 *
 * These components provide specialized date input patterns following the GOV.UK Design System.
 * Unlike the standard GOV.UK date input, these variants support specific date formats:
 * - Full dates (YYYY-MM-DD) - use `GovUKDateInputFullProps`
 * - Year-Month combinations (YYYY-MM) - use `GovUKDateInputYearMonthProps`
 * - Month-Day combinations (MM-DD) for recurring dates - use `GovUKDateInputMonthDayProps`
 *
 * All variants automatically parse ISO date strings and provide enhanced error handling
 * with field-specific error targeting via the `details.field` property.
 *
 * @see https://design-system.service.gov.uk/components/date-input/
 * @example
 * ```typescript
 * GovUKDateInputFull({
 *   code: 'date_of_birth',
 *   label: 'Date of birth',
 *   hint: 'For example, 31 3 1980',
 * })
 * ```
 */
export interface GovUKDateInputProps extends FieldBlockProps {
  /**
   * The label for the date input component.
   * When using fieldset, this becomes the legend text if no fieldset legend is specified.
   * @example 'Date of birth'
   * @example 'When did this happen?'
   */
  label?: ConditionalString

  /** Fieldset wrapper for the date input component. */
  fieldset?: {
    /**
     * Legend for the fieldset - describes the group of inputs.
     * If not provided, falls back to the `label` property.
     */
    legend?: {
      /** Text content of the legend */
      text?: ConditionalString

      /** HTML content of the legend (takes precedence over text) */
      html?: ConditionalString

      /** Additional CSS classes for the legend */
      classes?: ConditionalString

      /** Whether to render the legend as a page heading (wrapped in h1) */
      isPageHeading?: ConditionalBoolean
    }

    /** Additional CSS classes for the fieldset wrapper */
    classes?: ConditionalString

    /** HTML attributes to add to the fieldset */
    attributes?: Record<string, any>

    /** Element IDs to add to the fieldsets aria-describedby attribute */
    describedBy?: ConditionalString
  }

  /**
   * Hint text to provide additional guidance for the date input.
   *
   * @example 'For example, 31 3 1980' // Simple hint
   * @example { html: 'Enter the date as shown on your <strong>passport</strong>' } // Rich hint
   */
  hint?:
    | ConditionalString
    | {
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ConditionalString

        /** Text content of the hint */
        text?: ConditionalString

        /** HTML content of the hint (takes precedence over text) */
        html?: ConditionalString

        /** Additional CSS classes for the hint */
        classes?: ConditionalString

        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /** Additional options for the form group containing the date input component. */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ConditionalString

    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>

    /** Content to add before the date inputs. */
    beforeInputs?: {
      /** Text content to add before the inputs */
      text?: ConditionalString

      /** HTML content to add before the inputs (takes precedence over text) */
      html?: ConditionalString
    }

    /** Content to add after the date inputs */
    afterInputs?: {
      /** Text content to add after the inputs */
      text?: ConditionalString

      /** HTML content to add after the inputs (takes precedence over text) */
      html?: ConditionalString
    }
  }

  /**
   * The ID for the main date input component. Defaults to `code` if not provided.
   * Used to compose ID attributes for individual date fields (day, month, year).
   *
   * @example 'birthday' // Creates IDs like 'birthday-day', 'birthday-month', etc.
   */
  id?: ConditionalString

  /**
   * Optional prefix for the name attributes of individual date inputs.
   * If not provided, uses `code`. Separated by '-' from the field names.
   *
   * @example 'start-date' // Creates names like 'start-date[day]', 'start-date[month]', etc.
   */
  namePrefix?: ConditionalString

  /** Additional CSS classes to add to the date-input container. */
  classes?: ConditionalString

  /** Additional HTML attributes (such as data attributes) to add to the date-input container. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Date Input (Day, Month, Year) component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKDateInputProps` type or the `GovUKDateInputFull()` wrapper function instead.
 */
export interface GovUKDateInputFull extends FieldBlockDefinition, GovUKDateInputProps {
  /** Component variant identifier for full date input */
  variant: 'govukDateInputFull'
}

/**
 * GOV.UK Date Input (Month, Year) component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKDateInputProps` type or the `GovUKDateInputYearMonth()` wrapper function instead.
 */
export interface GovUKDateInputYearMonth extends FieldBlockDefinition, GovUKDateInputProps {
  /** Component variant identifier for year-month input */
  variant: 'govukDateInputYearMonth'
}

/**
 * GOV.UK Date Input (Day, Month) component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKDateInputProps` type or the `GovUKDateInputMonthDay()` wrapper function instead.
 */
export interface GovUKDateInputMonthDay extends FieldBlockDefinition, GovUKDateInputProps {
  /** Component variant identifier for month-day input */
  variant: 'govukDateInputMonthDay'
}

/**
 * Parse date values back to individual date parts.
 * Handles both ISO strings and raw objects (when ToISO formatter fails):
 * - Full dates: YYYY-MM-DD (e.g., "1980-03-31")
 * - Year-Month: YYYY-MM (e.g., "2025-03")
 * - Month-Day: MM-DD (e.g., "12-25") or --MM-DD (ISO 8601 recurring format)
 * - Year only: YYYY (e.g., "2024")
 * - Raw object: { day, month, year } (when formatter fails)
 */
function parseISOToDateParts(value: string | Record<string, string> | undefined): {
  year?: string
  month?: string
  day?: string
} {
  if (!value) {
    return {}
  }

  // Handle raw object (when ToISO formatter failed)
  if (typeof value === 'object' && value !== null) {
    return {
      year: value.year || undefined,
      month: value.month || undefined,
      day: value.day || undefined,
    }
  }

  if (typeof value !== 'string') {
    return {}
  }

  const iso = value

  // Full date: YYYY-MM-DD
  const fullDateMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (fullDateMatch) {
    return {
      year: fullDateMatch[1],
      month: fullDateMatch[2],
      day: fullDateMatch[3],
    }
  }

  // Year-Month: YYYY-MM
  const yearMonthMatch = iso.match(/^(\d{4})-(\d{2})$/)
  if (yearMonthMatch) {
    return {
      year: yearMonthMatch[1],
      month: yearMonthMatch[2],
    }
  }

  // Month-Day: MM-DD or --MM-DD (ISO 8601 recurring date format)
  const monthDayMatch = iso.match(/^(?:--)?(\d{2})-(\d{2})$/)
  if (monthDayMatch) {
    return {
      month: monthDayMatch[1],
      day: monthDayMatch[2],
    }
  }

  // Year only: YYYY (when month/day are empty)
  const yearOnlyMatch = iso.match(/^(\d{4})$/)
  if (yearOnlyMatch) {
    return {
      year: yearOnlyMatch[1],
    }
  }

  // Return empty object for invalid formats to allow graceful degradation
  return {}
}

/**
 * Supports field-specific error targeting through validation `details.field` property.
 */
function shouldHaveError(itemName: string, hasErrors: boolean, errorDetails?: Record<string, any>): boolean {
  if (!hasErrors) {
    return false
  }

  if (!errorDetails?.field) {
    return true // If date fails validation in general, all fields get error styling
  }

  return errorDetails.field === itemName
}

/**
 * Combine CSS classes, filtering out undefined values.
 * // TODO: Maybe we want to move this elsewhere? Seems like it could be useful
 */
function combineClasses(...classes: (string | undefined)[]): string | undefined {
  const combined = classes.filter(Boolean).join(' ')
  return combined || undefined
}

/**
 * Creates the individual input field configurations required by the GOV.UK date input template.
 */
function buildItems(
  fields: Array<{ name: 'day' | 'month' | 'year'; label: string; classes: string }>,
  block: EvaluatedBlock<GovUKDateInputFull | GovUKDateInputYearMonth | GovUKDateInputMonthDay>,
  dateParts: ReturnType<typeof parseISOToDateParts>,
  errorDetails?: Record<string, any>,
) {
  const namePrefix = block.namePrefix || block.code
  const idPrefix = block.id || block.code
  const hasErrors = Boolean(block.errors?.length)

  return fields.map(field => {
    const hasFieldError = shouldHaveError(field.name, hasErrors, errorDetails)
    const value = dateParts[field.name]

    return {
      id: `${idPrefix}-${field.name}`,
      name: `${namePrefix}[${field.name}]`,
      label: field.label,
      value,
      pattern: '[0-9]*',
      inputmode: 'numeric',
      classes: combineClasses(field.classes, hasFieldError && 'govuk-input--error'),
    }
  })
}

/**
 * Creates the parameter object required by the GOV.UK date input template
 */
function buildParams(
  block: EvaluatedBlock<GovUKDateInputFull | GovUKDateInputYearMonth | GovUKDateInputMonthDay>,
  items: ReturnType<typeof buildItems>,
) {
  return {
    id: block.id || block.code,
    fieldset: block.fieldset || {
      legend: {
        text: block.label,
      },
    },
    hint: block.hint ? (typeof block.hint === 'object' ? block.hint : { text: block.hint }) : undefined,
    errorMessage: block.errors?.length && { text: block.errors[0].message },
    formGroup: block.formGroup,
    items,
    classes: block.classes,
    attributes: block.attributes,
  }
}

/**
 * Full date input component (YYYY-MM-DD)
 * Renders day, month, and year fields
 */
export const govukDateInputFull = buildNunjucksComponent<GovUKDateInputFull>(
  'govukDateInputFull',
  async (block, nunjucksEnv) => {
    const dateParts = parseISOToDateParts(block.value as string | Record<string, string> | undefined)
    const errorDetails = block.errors?.[0]?.details

    const items = buildItems(
      [
        { name: 'day', label: 'Day', classes: 'govuk-input--width-2' },
        { name: 'month', label: 'Month', classes: 'govuk-input--width-2' },
        { name: 'year', label: 'Year', classes: 'govuk-input--width-4' },
      ],
      block,
      dateParts,
      errorDetails,
    )

    const params = buildParams(block, items)

    return nunjucksEnv.render('govuk/components/date-input/template.njk', { params })
  },
)

/**
 * Year and month input component (YYYY-MM)
 * Renders only month and year fields
 */
export const govukDateInputYearMonth = buildNunjucksComponent<GovUKDateInputYearMonth>(
  'govukDateInputYearMonth',
  async (block, nunjucksEnv) => {
    const dateParts = parseISOToDateParts(block.value as string | Record<string, string> | undefined)
    const errorDetails = block.errors?.[0]?.details

    const items = buildItems(
      [
        { name: 'month', label: 'Month', classes: 'govuk-input--width-2' },
        { name: 'year', label: 'Year', classes: 'govuk-input--width-4' },
      ],
      block,
      dateParts,
      errorDetails,
    )

    const params = buildParams(block, items)

    return nunjucksEnv.render('govuk/components/date-input/template.njk', { params })
  },
)

/**
 * Month and day input component (MM-DD)
 * Renders only month and day fields for recurring dates
 */
export const govukDateInputMonthDay = buildNunjucksComponent<GovUKDateInputMonthDay>(
  'govukDateInputMonthDay',
  async (block, nunjucksEnv) => {
    const dateParts = parseISOToDateParts(block.value as string | Record<string, string> | undefined)
    const errorDetails = block.errors?.[0]?.details

    const items = buildItems(
      [
        { name: 'day', label: 'Day', classes: 'govuk-input--width-2' },
        { name: 'month', label: 'Month', classes: 'govuk-input--width-2' },
      ],
      block,
      dateParts,
      errorDetails,
    )

    const params = buildParams(block, items)

    return nunjucksEnv.render('govuk/components/date-input/template.njk', { params })
  },
)

/**
 * Creates a GOV.UK Date Input field with day, month, and year.
 * Expects and outputs ISO date strings in YYYY-MM-DD format.
 *
 * @see https://design-system.service.gov.uk/components/date-input/
 * @example
 * ```typescript
 * GovUKDateInputFull({
 *   code: 'date_of_birth',
 *   label: 'Date of birth',
 *   hint: 'For example, 31 3 1980',
 * })
 * ```
 */
export function GovUKDateInputFull(props: GovUKDateInputProps): GovUKDateInputFull {
  return fieldBuilder<GovUKDateInputFull>({ ...props, variant: 'govukDateInputFull' })
}

/**
 * Creates a GOV.UK Date Input field with month and year only.
 * Expects and outputs ISO date strings in YYYY-MM format.
 * Useful for credit card expiry dates, employment periods, etc.
 *
 * @see https://design-system.service.gov.uk/components/date-input/
 * @example
 * ```typescript
 * GovUKDateInputYearMonth({
 *   code: 'card_expiry',
 *   label: 'Expiry date',
 *   hint: 'For example, 03 2025',
 * })
 * ```
 */
export function GovUKDateInputYearMonth(props: GovUKDateInputProps): GovUKDateInputYearMonth {
  return fieldBuilder<GovUKDateInputYearMonth>({ ...props, variant: 'govukDateInputYearMonth' })
}

/**
 * Creates a GOV.UK Date Input field with day and month only.
 * Expects and outputs ISO date strings in MM-DD format.
 * Useful for recurring dates like birthdays or anniversaries.
 *
 * @see https://design-system.service.gov.uk/components/date-input/
 * @example
 * ```typescript
 * GovUKDateInputMonthDay({
 *   code: 'anniversary',
 *   label: 'Anniversary date',
 *   hint: 'For example, 25 12',
 * })
 * ```
 */
export function GovUKDateInputMonthDay(props: GovUKDateInputProps): GovUKDateInputMonthDay {
  return fieldBuilder<GovUKDateInputMonthDay>({ ...props, variant: 'govukDateInputMonthDay' })
}

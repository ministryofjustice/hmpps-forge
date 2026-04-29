import {
  ResolvableBoolean,
  ResolvableString,
  EvaluatedBlock,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@ministryofjustice/hmpps-forge/core/components'
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { field as buildField, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  normaliseGovukErrorMessage,
  normaliseGovukFieldset,
  normaliseGovukTextParam,
} from '../../utils/govukParamNormalisers'

/**
 * Props for GOV.UK Date Input Components.
 *
 * These components provide specialized date input patterns following the GOV.UK Design System.
 * Three variants are available:
 * - Full dates (YYYY-MM-DD) - use `GovUKDateInputFull`
 * - Year-Month combinations (YYYY-MM) - use `GovUKDateInputYearMonth`
 * - Month-Day combinations (MM-DD) for recurring dates - use `GovUKDateInputMonthDay`
 *
 * The wrapper functions automatically add formatters (to convert submitted date parts
 * to an ISO string for storage) and parsers (to convert the stored ISO string back to
 * date parts for display). Enhanced error handling with field-specific error targeting
 * is supported via the `details.field` property.
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
  label?: ResolvableString

  /** Fieldset wrapper for the date input component. */
  fieldset?: {
    /**
     * Legend for the fieldset - describes the group of inputs.
     * If not provided, falls back to the `label` property.
     */
    legend?: {
      /** Text content of the legend */
      text?: ResolvableString

      /** HTML content of the legend (takes precedence over text) */
      html?: ResolvableString

      /** Additional CSS classes for the legend */
      classes?: ResolvableString

      /** Whether to render the legend as a page heading (wrapped in h1) */
      isPageHeading?: ResolvableBoolean
    }

    /** Additional CSS classes for the fieldset wrapper */
    classes?: ResolvableString

    /** HTML attributes to add to the fieldset */
    attributes?: Record<string, any>

    /** Element IDs to add to the fieldsets aria-describedby attribute */
    describedBy?: ResolvableString
  }

  /**
   * Hint text to provide additional guidance for the date input.
   *
   * @example 'For example, 31 3 1980' // Simple hint
   * @example { html: 'Enter the date as shown on your <strong>passport</strong>' } // Rich hint
   */
  hint?:
    | ResolvableString
    | {
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ResolvableString

        /** Text content of the hint */
        text?: ResolvableString

        /** HTML content of the hint (takes precedence over text) */
        html?: ResolvableString

        /** Additional CSS classes for the hint */
        classes?: ResolvableString

        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /** Additional options for the form group containing the date input component. */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ResolvableString

    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>

    /** Content to add before the date inputs. */
    beforeInputs?: {
      /** Text content to add before the inputs */
      text?: ResolvableString

      /** HTML content to add before the inputs (takes precedence over text) */
      html?: ResolvableString
    }

    /** Content to add after the date inputs */
    afterInputs?: {
      /** Text content to add after the inputs */
      text?: ResolvableString

      /** HTML content to add after the inputs (takes precedence over text) */
      html?: ResolvableString
    }
  }

  /**
   * The ID for the main date input component. Defaults to `code` if not provided.
   * Used to compose ID attributes for individual date fields (day, month, year).
   *
   * @example 'birthday' // Creates IDs like 'birthday-day', 'birthday-month', etc.
   */
  id?: ResolvableString

  /**
   * Optional prefix for the name attributes of individual date inputs.
   * If not provided, uses `code`. Separated by '-' from the field names.
   *
   * @example 'start-date' // Creates names like 'start-date[day]', 'start-date[month]', etc.
   */
  namePrefix?: ResolvableString

  /** Additional CSS classes to add to the date-input container. */
  classes?: ResolvableString

  /** Additional HTML attributes (such as data attributes) to add to the date-input container. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Date Input (Day, Month, Year) component interface.
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKDateInputProps` type or the `GovUKDateInputFull()` wrapper function instead.
 */
export interface GovUKDateInputFull extends FieldBlockDefinition, GovUKDateInputProps {
  /** Component variant identifier for full date input */
  variant: 'govukDateInputFull'
}

/**
 * GOV.UK Date Input (Month, Year) component interface.
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKDateInputProps` type or the `GovUKDateInputYearMonth()` wrapper function instead.
 */
export interface GovUKDateInputYearMonth extends FieldBlockDefinition, GovUKDateInputProps {
  /** Component variant identifier for year-month input */
  variant: 'govukDateInputYearMonth'
}

/**
 * GOV.UK Date Input (Day, Month) component interface.
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKDateInputProps` type or the `GovUKDateInputMonthDay()` wrapper function instead.
 */
export interface GovUKDateInputMonthDay extends FieldBlockDefinition, GovUKDateInputProps {
  /** Component variant identifier for month-day input */
  variant: 'govukDateInputMonthDay'
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
  dateParts: { year?: string; month?: string; day?: string },
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
      classes: combineClasses(field.classes, hasFieldError ? 'govuk-input--error' : undefined),
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
    fieldset: normaliseGovukFieldset(block.fieldset, block.label),
    hint: normaliseGovukTextParam(block.hint),
    errorMessage: normaliseGovukErrorMessage(block.errors),
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
  (block, nunjucksEnv) => {
    const dateParts = (block.value as { day?: string; month?: string; year?: string } | undefined) ?? {}
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
  (block, nunjucksEnv) => {
    const dateParts = (block.value as { day?: string; month?: string; year?: string } | undefined) ?? {}
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
  (block, nunjucksEnv) => {
    const dateParts = (block.value as { day?: string; month?: string; year?: string } | undefined) ?? {}
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

const fullDatePaths = { year: 'year', month: 'month', day: 'day' }
const yearMonthPaths = { year: 'year', month: 'month' }
const monthDayPaths = { month: 'month', day: 'day' }

/**
 * Creates a GOV.UK Date Input field with day, month, and year.
 * Stores the value as an ISO date string in YYYY-MM-DD format.
 * Automatically adds formatters and parsers for the ISO conversion.
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
  return buildField<GovUKDateInputFull>({
    ...props,
    variant: 'govukDateInputFull',
    formatters: [Transformer.Object.ToISO(fullDatePaths), ...(props.formatters ?? [])],
    parsers: [Transformer.Object.FromISO(fullDatePaths), ...(props.parsers ?? [])],
  })
}

/**
 * Creates a GOV.UK Date Input field with month and year only.
 * Stores the value as an ISO date string in YYYY-MM format.
 * Automatically adds formatters and parsers for the ISO conversion.
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
  return buildField<GovUKDateInputYearMonth>({
    ...props,
    variant: 'govukDateInputYearMonth',
    formatters: [Transformer.Object.ToISO(yearMonthPaths), ...(props.formatters ?? [])],
    parsers: [Transformer.Object.FromISO(yearMonthPaths), ...(props.parsers ?? [])],
  })
}

/**
 * Creates a GOV.UK Date Input field with day and month only.
 * Stores the value as an ISO date string in MM-DD format.
 * Automatically adds formatters and parsers for the ISO conversion.
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
  return buildField<GovUKDateInputMonthDay>({
    ...props,
    variant: 'govukDateInputMonthDay',
    formatters: [Transformer.Object.ToISO(monthDayPaths), ...(props.formatters ?? [])],
    parsers: [Transformer.Object.FromISO(monthDayPaths), ...(props.parsers ?? [])],
  })
}

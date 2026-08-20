import { z } from 'zod'
import {
  ResolvableBoolean,
  ResolvableString,
  FieldBlockDefinition,
  ResolvedPropsOf,
} from '@ministryofjustice/hmpps-forge/core/components'
import { Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import {
  normaliseGovukErrorMessage,
  normaliseGovukFieldset,
  normaliseGovukTextParam,
} from '../../utils/govukParamNormalisers'

/**
 * The props shared by every GOV.UK Date Input variant.
 */
export interface GovUKDateInputBase {
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

/** GOV.UK Date Input capturing a full date - day, month and year. */
export interface GovUKDateInputFull extends FieldBlockDefinition, GovUKDateInputBase {}

/** GOV.UK Date Input capturing a month and year only. */
export interface GovUKDateInputYearMonth extends FieldBlockDefinition, GovUKDateInputBase {}

/** GOV.UK Date Input capturing a day and month only. */
export interface GovUKDateInputMonthDay extends FieldBlockDefinition, GovUKDateInputBase {}

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
  block: ResolvedPropsOf<GovUKDateInputFull | GovUKDateInputYearMonth | GovUKDateInputMonthDay>,
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
  block: ResolvedPropsOf<GovUKDateInputFull | GovUKDateInputYearMonth | GovUKDateInputMonthDay>,
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
export const GovUKDateInputFull = nunjucksComponent<GovUKDateInputFull>('govukDateInputFull', {
  field: true,
  inputSchema: z.object({ year: z.string(), month: z.string(), day: z.string() }).strict(),
  // The rendered inputs are `${id}-day/-month/-year`, so error summary links land on the first.
  errorAnchor: props => `${props.id || props.code}-day`,
  prepare: props => ({
    ...props,
    formatters: [Transformer.Object.ToISO(fullDatePaths), ...(props.formatters ?? [])],
    parsers: [Transformer.Object.FromISO(fullDatePaths), ...(props.parsers ?? [])],
  }),
  render: (props, nunjucksEnv) => {
    const dateParts = (props.value as { day?: string; month?: string; year?: string } | undefined) ?? {}
    const errorDetails = props.errors?.[0]?.details

    const items = buildItems(
      [
        { name: 'day', label: 'Day', classes: 'govuk-input--width-2' },
        { name: 'month', label: 'Month', classes: 'govuk-input--width-2' },
        { name: 'year', label: 'Year', classes: 'govuk-input--width-4' },
      ],
      props,
      dateParts,
      errorDetails,
    )

    const params = buildParams(props, items)

    return nunjucksEnv.render('govuk/components/date-input/template.njk', { params })
  },
})

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
export const GovUKDateInputYearMonth = nunjucksComponent<GovUKDateInputYearMonth>('govukDateInputYearMonth', {
  field: true,
  inputSchema: z.object({ year: z.string(), month: z.string() }).strict(),
  // The rendered inputs are `${id}-month/-year`, so error summary links land on the first.
  errorAnchor: props => `${props.id || props.code}-month`,
  prepare: props => ({
    ...props,
    formatters: [Transformer.Object.ToISO(yearMonthPaths), ...(props.formatters ?? [])],
    parsers: [Transformer.Object.FromISO(yearMonthPaths), ...(props.parsers ?? [])],
  }),
  render: (props, nunjucksEnv) => {
    const dateParts = (props.value as { day?: string; month?: string; year?: string } | undefined) ?? {}
    const errorDetails = props.errors?.[0]?.details

    const items = buildItems(
      [
        { name: 'month', label: 'Month', classes: 'govuk-input--width-2' },
        { name: 'year', label: 'Year', classes: 'govuk-input--width-4' },
      ],
      props,
      dateParts,
      errorDetails,
    )

    const params = buildParams(props, items)

    return nunjucksEnv.render('govuk/components/date-input/template.njk', { params })
  },
})

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
export const GovUKDateInputMonthDay = nunjucksComponent<GovUKDateInputMonthDay>('govukDateInputMonthDay', {
  field: true,
  inputSchema: z.object({ month: z.string(), day: z.string() }).strict(),
  // The rendered inputs are `${id}-day/-month`, so error summary links land on the first.
  errorAnchor: props => `${props.id || props.code}-day`,
  prepare: props => ({
    ...props,
    formatters: [Transformer.Object.ToISO(monthDayPaths), ...(props.formatters ?? [])],
    parsers: [Transformer.Object.FromISO(monthDayPaths), ...(props.parsers ?? [])],
  }),
  render: (props, nunjucksEnv) => {
    const dateParts = (props.value as { day?: string; month?: string; year?: string } | undefined) ?? {}
    const errorDetails = props.errors?.[0]?.details

    const items = buildItems(
      [
        { name: 'day', label: 'Day', classes: 'govuk-input--width-2' },
        { name: 'month', label: 'Month', classes: 'govuk-input--width-2' },
      ],
      props,
      dateParts,
      errorDetails,
    )

    const params = buildParams(props, items)

    return nunjucksEnv.render('govuk/components/date-input/template.njk', { params })
  },
})

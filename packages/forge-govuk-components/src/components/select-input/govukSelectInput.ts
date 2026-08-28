import { z } from 'zod'
import { ResolvableFieldProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukErrorMessage, normaliseGovukTextParam } from '../../utils/govukParamNormalisers'

/**
 * Select item configuration
 */
export interface SelectItem {
  /** Value for the option. If omitted, the value is taken from the text content. */
  value?: string
  /** Text for the option item. */
  text: string
  /** Whether the option should be selected when the page loads. */
  selected?: boolean
  /** Sets the option item as disabled. */
  disabled?: boolean
  /** HTML attributes to add to the option. */
  attributes?: Record<string, any>
  /** Conditional visibility for this option. */
  visibleWhen?: boolean
}

/**
 * GOV.UK Select Input component.
 *
 * @see https://design-system.service.gov.uk/components/select/
 * @example
 * ```typescript
 * GovUKSelectInput({
 *   code: 'country',
 *   label: 'Select your country',
 *   items: [
 *     { value: '', text: 'Choose an option' },
 *     { value: 'gb', text: 'United Kingdom' },
 *     { value: 'fr', text: 'France' },
 *   ],
 * })
 * ```
 */
export type GovUKSelectInput = ResolvableFieldProps<{
  /**
   * The ID of the select. Defaults to the value of `code` if not provided.
   * @example 'country-select'
   */
  id?: string

  /**
   * The items within the select component.
   * Each item represents an option in the dropdown.
   *
   * @example [{ value: '', text: 'Choose an option' }, { value: 'uk', text: 'United Kingdom' }]
   */
  items: SelectItem[]

  /**
   * The label used by the select component.
   * Can be a simple string or a complex object with additional properties.
   *
   * @example 'Select your country'
   * @example { text: 'Country', classes: 'govuk-label--l' }
   */
  label:
    | string
    | {
        /** Text content of the label */
        text?: string
        /** HTML content of the label (takes precedence over text) */
        html?: string
        /** Additional CSS classes for the label */
        classes?: string
        /** For attribute - automatically set if not provided */
        for?: string
        /** Whether to render the label as a page heading (wrapped in h1) */
        isPageHeading?: boolean
        /** Additional HTML attributes for the label */
        attributes?: Record<string, any>
      }

  /**
   * Can be used to add a hint to the select component.
   * Provides additional context or instructions for the user.
   *
   * @example 'Select the country where you currently live'
   */
  hint?:
    | string
    | {
        /** Text content of the hint */
        text?: string
        /** HTML content of the hint (takes precedence over text) */
        html?: string
        /** Additional CSS classes for the hint */
        classes?: string
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: string
        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /**
   * If `true`, select box will be disabled.
   * Use the `disabled` option on each individual item to only disable certain options.
   * @example true
   */
  disabled?: boolean

  /**
   * One or more element IDs to add to the `aria-describedby` attribute.
   * Used to provide additional descriptive information for screenreader users.
   *
   * @example 'country-select-help'
   */
  describedBy?: string

  /**
   * Additional options for the form group containing the select component.
   */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: string
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /** Content to add before the select element. */
    beforeInput?: {
      /** Text content to add before the select */
      text?: string
      /** HTML content to add before the select (takes precedence over text) */
      html?: string
    }
    /** Content to add after the select element. */
    afterInput?: {
      /** Text content to add after the select */
      text?: string
      /** HTML content to add after the select (takes precedence over text) */
      html?: string
    }
  }

  /**
   * Additional CSS classes to add to the select element.
   * @example 'govuk-!-width-one-half'
   */
  classes?: string

  /**
   * Additional HTML attributes to add to the select element.
   * @example { 'data-module': 'accessible-autocomplete' }
   */
  attributes?: Record<string, any>
}>

/**
 * GOV.UK Select Input component.
 *
 * @see https://design-system.service.gov.uk/components/select/
 * @example
 * ```typescript
 * GovUKSelectInput({
 *   code: 'country',
 *   label: 'Select your country',
 *   items: [
 *     { value: '', text: 'Choose an option' },
 *     { value: 'gb', text: 'United Kingdom' },
 *     { value: 'fr', text: 'France' },
 *   ],
 * })
 * ```
 */
export const GovUKSelectInput = nunjucksComponent<GovUKSelectInput>('govukSelectInput', {
  field: true,
  inputSchema: z.string(),
  // The rendered select's id matches the render params below, so error summary links land on it.
  errorAnchor: props => props.id ?? props.code,
  render: (props, nunjucksEnv) => {
    const params = {
      id: props.id ?? props.code,
      name: props.code,
      items: props.items.filter(item => item.visibleWhen !== false),
      label: normaliseGovukTextParam(props.label),
      hint: normaliseGovukTextParam(props.hint),
      value: props.value,
      disabled: props.disabled,
      describedBy: props.describedBy,
      formGroup: props.formGroup,
      classes: props.classes,
      attributes: props.attributes,
      errorMessage: normaliseGovukErrorMessage(props.errors),
    }

    return nunjucksEnv.render('govuk/components/select/template.njk', {
      params,
    })
  },
})

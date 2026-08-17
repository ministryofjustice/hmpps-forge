import { z } from 'zod'
import {
  FieldBlockDefinition,
  ResolvableArray,
  ResolvableBoolean,
  ResolvableString,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { normaliseGovukErrorMessage, normaliseGovukTextParam } from '../../utils/govukParamNormalisers'

/**
 * Select item configuration
 */
export interface SelectItem {
  /** Value for the option. If omitted, the value is taken from the text content. */
  value?: ResolvableString
  /** Text for the option item. */
  text: ResolvableString
  /** Whether the option should be selected when the page loads. */
  selected?: ResolvableBoolean
  /** Sets the option item as disabled. */
  disabled?: ResolvableBoolean
  /** HTML attributes to add to the option. */
  attributes?: Record<string, any>
  /** Conditional visibility for this option. */
  visibleWhen?: ResolvableBoolean
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
export interface GovUKSelectInput extends FieldBlockDefinition {
  /**
   * The ID of the select. Defaults to the value of `code` if not provided.
   * @example 'country-select'
   */
  id?: ResolvableString

  /**
   * The items within the select component.
   * Each item represents an option in the dropdown.
   *
   * @example [{ value: '', text: 'Choose an option' }, { value: 'uk', text: 'United Kingdom' }]
   */
  items: ResolvableArray<SelectItem>

  /**
   * The label used by the select component.
   * Can be a simple string or a complex object with additional properties.
   *
   * @example 'Select your country'
   * @example { text: 'Country', classes: 'govuk-label--l' }
   */
  label:
    | ResolvableString
    | {
        /** Text content of the label */
        text?: ResolvableString
        /** HTML content of the label (takes precedence over text) */
        html?: ResolvableString
        /** Additional CSS classes for the label */
        classes?: ResolvableString
        /** For attribute - automatically set if not provided */
        for?: ResolvableString
        /** Whether to render the label as a page heading (wrapped in h1) */
        isPageHeading?: ResolvableBoolean
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
    | ResolvableString
    | {
        /** Text content of the hint */
        text?: ResolvableString
        /** HTML content of the hint (takes precedence over text) */
        html?: ResolvableString
        /** Additional CSS classes for the hint */
        classes?: ResolvableString
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ResolvableString
        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /**
   * If `true`, select box will be disabled.
   * Use the `disabled` option on each individual item to only disable certain options.
   * @example true
   */
  disabled?: ResolvableBoolean

  /**
   * One or more element IDs to add to the `aria-describedby` attribute.
   * Used to provide additional descriptive information for screenreader users.
   *
   * @example 'country-select-help'
   */
  describedBy?: ResolvableString

  /**
   * Additional options for the form group containing the select component.
   */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ResolvableString
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /** Content to add before the select element. */
    beforeInput?: {
      /** Text content to add before the select */
      text?: ResolvableString
      /** HTML content to add before the select (takes precedence over text) */
      html?: ResolvableString
    }
    /** Content to add after the select element. */
    afterInput?: {
      /** Text content to add after the select */
      text?: ResolvableString
      /** HTML content to add after the select (takes precedence over text) */
      html?: ResolvableString
    }
  }

  /**
   * Additional CSS classes to add to the select element.
   * @example 'govuk-!-width-one-half'
   */
  classes?: ResolvableString

  /**
   * Additional HTML attributes to add to the select element.
   * @example { 'data-module': 'accessible-autocomplete' }
   */
  attributes?: Record<string, any>
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

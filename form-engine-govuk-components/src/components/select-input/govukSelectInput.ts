import { ConditionalBoolean, ConditionalString, FieldBlockDefinition } from '@form-engine/form/types/structures.type'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'

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
}

/**
 * GOV.UK Select Input Component
 *
 * A dropdown select component following the GOV.UK Design System patterns.
 * Use sparingly - radios or checkboxes are often better alternatives.
 *
 * @see https://design-system.service.gov.uk/components/select/
 */
export interface GovUKSelectInput extends FieldBlockDefinition {
  /** Component variant identifier */
  variant: 'govukSelectInput'

  /**
   * The ID of the select. Defaults to the value of `code` if not provided.
   * @example 'country-select'
   */
  id?: ConditionalString

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
    | ConditionalString
    | {
        /** Text content of the label */
        text?: ConditionalString
        /** HTML content of the label (takes precedence over text) */
        html?: ConditionalString
        /** Additional CSS classes for the label */
        classes?: ConditionalString
        /** For attribute - automatically set if not provided */
        for?: ConditionalString
        /** Whether to render the label as a page heading (wrapped in h1) */
        isPageHeading?: ConditionalBoolean
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
    | ConditionalString
    | {
        /** Text content of the hint */
        text?: ConditionalString
        /** HTML content of the hint (takes precedence over text) */
        html?: ConditionalString
        /** Additional CSS classes for the hint */
        classes?: ConditionalString
        /** Unique ID for the hint (auto-generated if not provided) */
        id?: ConditionalString
        /** Additional HTML attributes for the hint */
        attributes?: Record<string, any>
      }

  /**
   * Value for the option which should be selected.
   * Use this as an alternative to setting the `selected` option on each individual item.
   * @example 'uk'
   */
  value?: ConditionalString

  /**
   * If `true`, select box will be disabled.
   * Use the `disabled` option on each individual item to only disable certain options.
   * @example true
   */
  disabled?: ConditionalBoolean

  /**
   * Additional options for the form group containing the select component.
   */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ConditionalString
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /** Content to add before the select element. */
    beforeInput?: {
      /** Text content to add before the select */
      text?: ConditionalString
      /** HTML content to add before the select (takes precedence over text) */
      html?: ConditionalString
    }
    /** Content to add after the select element. */
    afterInput?: {
      /** Text content to add after the select */
      text?: ConditionalString
      /** HTML content to add after the select (takes precedence over text) */
      html?: ConditionalString
    }
  }

  /**
   * Additional CSS classes to add to the select element.
   * @example 'govuk-!-width-one-half'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes to add to the select element.
   * @example { 'data-module': 'accessible-autocomplete' }
   */
  attributes?: Record<string, any>
}

export const govukSelectInput = buildNunjucksComponent<GovUKSelectInput>(
  'govukSelectInput',
  async (block, nunjucksEnv) => {
    const params = {
      id: block.id ?? block.code,
      name: block.code,
      items: block.items,
      label: block.label ? (typeof block.label === 'object' ? block.label : { text: block.label }) : undefined,
      hint: block.hint ? (typeof block.hint === 'object' ? block.hint : { text: block.hint }) : undefined,
      value: block.value,
      disabled: block.disabled,
      formGroup: block.formGroup,
      classes: block.classes,
      attributes: block.attributes,
      errorMessage: block.errors?.length && { text: block.errors[0].message },
    }

    return nunjucksEnv.render('govuk/components/select/template.njk', {
      params,
    })
  },
)

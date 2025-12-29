import {
  ConditionalBoolean,
  ConditionalString,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@form-engine/form/types/structures.type'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import { field } from '@form-engine/form/builders'

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
 * Props for the GovUKSelectInput component.
 * @see https://design-system.service.gov.uk/components/select/
 *
 * @example
 * ```typescript
 * GovUKSelectInput({
 *   code: 'country',
 *   label: 'Select your country',
 *   items: [
 *     { value: '', text: 'Choose an option' },
 *     { value: 'gb', text: 'United Kingdom' },
 *   ],
 * })
 * ```
 */
export interface GovUKSelectInputProps extends FieldBlockProps {
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

/**
 * GOV.UK Select Input Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKSelectInputProps` type or the `GovUKSelectInput()` wrapper function instead.
 */
export interface GovUKSelectInput extends FieldBlockDefinition, GovUKSelectInputProps {
  /** Component variant identifier */
  variant: 'govukSelectInput'
}

/**
 * Creates a GOV.UK Select Input (dropdown) field.
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
export function GovUKSelectInput(props: GovUKSelectInputProps): GovUKSelectInput {
  return field<GovUKSelectInput>({ ...props, variant: 'govukSelectInput' })
}

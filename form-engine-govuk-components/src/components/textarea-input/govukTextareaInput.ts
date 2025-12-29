import {
  ConditionalBoolean,
  ConditionalString,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@form-engine/form/types/structures.type'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import { field } from '@form-engine/form/builders'

/**
 * Props for the GovUKTextareaInput component.
 * @see https://design-system.service.gov.uk/components/textarea/
 * @example
 * ```typescript
 * GovUKTextareaInput({
 *   code: 'comments',
 *   label: 'Please provide any additional comments',
 *   hint: 'Include as much detail as possible',
 *   rows: '8',
 * })
 * ```
 */
export interface GovUKTextareaInputProps extends FieldBlockProps {
  /**
   * The ID of the textarea. Defaults to the value of `code` if not provided.
   *
   * @example 'user-feedback'
   */
  id?: ConditionalString

  /**
   * Optional field to enable or disable the `spellcheck` attribute on the textarea.
   * When not specified, browsers will use their default behavior.
   *
   * @example true // Enable spellcheck
   */
  spellcheck?: ConditionalBoolean

  /**
   * Optional number of textarea rows. Defaults to 5 rows if not specified.
   * Controls the initial height of the textarea.
   *
   * @example '8' // Taller textarea
   * @example '3' // Shorter textarea
   */
  rows?: ConditionalString

  /**
   * The label used by the textarea component.
   * Can be a simple string or a complex object with additional properties.
   *
   * @example 'Your comments' // Simple string label
   * @example { text: 'Feedback', classes: 'govuk-label--l' } // Object with styling
   */
  label?:
    | ConditionalString
    | {
        /** Text content of the label */
        text?: ConditionalString

        /** HTML content of the label (takes precedence over text) */
        html?: ConditionalString

        /** Additional CSS classes for the label */
        classes?: ConditionalString

        /** Whether to render the label as a page heading (wrapped in h1) */
        isPageHeading?: ConditionalBoolean

        /** Additional HTML attributes for the label */
        attributes?: Record<string, any>
      }

  /**
   * Can be used to add a hint to the textarea component.
   * Provides additional context or instructions for the user.
   *
   * @example 'Include as much detail as possible' // Simple string hint
   * @example { html: 'See <a href="/help">guidance</a> for examples' } // Rich HTML hint
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

  /** Additional options for the form group containing the textarea component. */
  formGroup?: {
    /** Classes to add to the form group wrapper. */
    classes?: ConditionalString

    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>

    /** Content to add before the textarea input */
    beforeInput?: {
      /** Text content to add before the textarea */
      text?: ConditionalString

      /** HTML content to add before the textarea (takes precedence over text) */
      html?: ConditionalString
    }

    /** Content to add after the textarea input. */
    afterInput?: {
      /** Text content to add after the textarea */
      text?: ConditionalString

      /** HTML content to add after the textarea (takes precedence over text) */
      html?: ConditionalString
    }
  }

  /** Additional CSS classes to add to the textarea element */
  classes?: ConditionalString

  /**
   * If `true`, textarea will be disabled and cannot be edited by the user.
   *
   * @example true // Disable the textarea
   */
  disabled?: ConditionalBoolean

  /**
   * Attribute to meet WCAG success criterion 1.3.5: Identify input purpose.
   * Helps browsers provide appropriate autofill suggestions.
   *
   * @see https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html
   * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
   * @example 'street-address' // For address fields
   * @example 'off' // Disable autocomplete
   */
  autocomplete?: ConditionalString

  /** Additional HTML attributes (such as data attributes) to add to the textarea element. */
  attributes?: Record<string, any>
}

export const govukTextareaInput = buildNunjucksComponent<GovUKTextareaInput>(
  'govukTextarea',
  async (block, nunjucksEnv) => {
    const params = {
      id: block.id ?? block.code,
      name: block.code,
      spellcheck: block.spellcheck,
      rows: block.rows || '5',
      value: block.value,
      disabled: block.disabled,
      label: block.label ? (typeof block.label === 'object' ? block.label : { text: block.label }) : undefined,
      hint: block.hint ? (typeof block.hint === 'object' ? block.hint : { text: block.hint }) : undefined,
      errorMessage: block.errors?.length && { text: block.errors[0].message },
      formGroup: block.formGroup,
      classes: block.classes,
      autocomplete: block.autocomplete,
      attributes: block.attributes,
    }

    return nunjucksEnv.render('govuk/components/textarea/template.njk', {
      params,
    })
  },
)

/**
 * GOV.UK Textarea Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKTextareaInputProps` type or the `GovUKTextareaInput()` wrapper function instead.
 */
export interface GovUKTextareaInput extends FieldBlockDefinition, GovUKTextareaInputProps {
  /** Component variant identifier */
  variant: 'govukTextarea'
}

/**
 * Creates a GOV.UK Textarea field for multi-line text input.
 *
 * @see https://design-system.service.gov.uk/components/textarea/
 * @example
 * ```typescript
 * GovUKTextareaInput({
 *   code: 'comments',
 *   label: 'Please provide any additional comments',
 *   hint: 'Include as much detail as possible',
 *   rows: '8',
 * })
 * ```
 */
export function GovUKTextareaInput(props: GovUKTextareaInputProps): GovUKTextareaInput {
  return field<GovUKTextareaInput>({ ...props, variant: 'govukTextarea' })
}

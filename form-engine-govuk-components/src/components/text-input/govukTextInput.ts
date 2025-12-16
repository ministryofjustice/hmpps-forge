import { ConditionalBoolean, ConditionalString, FieldBlockDefinition } from '@form-engine/form/types/structures.type'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'

/**
 * GOV.UK Text Input Component
 *
 * A single-line text input component following the GOV.UK Design System patterns.
 * Provides comprehensive form validation integration, accessibility support, and
 * advanced features like prefixes, suffixes, and custom input types.
 *
 * @see https://design-system.service.gov.uk/components/text-input/
 */
export interface GovUKTextInput extends FieldBlockDefinition {
  /** Component variant identifier */
  variant: 'govukTextInput'

  /**
   * The ID of the input. Defaults to the value of `code` if not provided.
   * @example 'user-email'
   */
  id?: ConditionalString

  /**
   * The label used by the text input component.
   * Can be a simple string or a complex object with additional properties.
   *
   * @example 'Full name' // Simple string label
   * @example { text: 'Email address', classes: 'govuk-label--l' } // Object with styling
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
   * Can be used to add a hint to the text input component.
   * Provides additional context or instructions for the user.
   *
   * @example 'For example, john.smith@example.com' // Simple hint
   * @example { html: 'We'll only use this to send you <strong>important updates</strong>' } // Rich HTML hint
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
   * Optional initial value of the input.
   * Sets the default content that appears when the input is first rendered.
   * @example 'user@example.com'
   */
  value?: ConditionalString

  /**
   * Type of input control to render. Defaults to "text".
   * Different types provide specialized keyboard layouts and validation on mobile devices.
   *
   * @example 'email' // Email keyboard on mobile
   * @example 'password' // Masked input
   * @example 'tel' // Numeric keyboard for phone numbers
   */
  inputType?: 'text' | 'email' | 'url' | 'tel' | 'password' | 'number'

  /**
   * Optional value for the inputmode attribute.
   * Provides hints about the expected input type to optimize virtual keyboards.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode
   * @example 'email' // Email-optimized keyboard
   * @example 'decimal' // Numeric keyboard with decimal point
   * @example 'search' // Search-optimized keyboard
   */
  inputMode?: 'text' | 'decimal' | 'search' | 'email' | 'url' | 'numeric'

  /**
   * If `true`, input will be disabled and cannot be edited by the user.
   * @example true // Disable the input
   */
  disabled?: ConditionalBoolean

  /**
   * Attribute to meet WCAG success criterion 1.3.5: Identify input purpose.
   * Helps browsers provide appropriate autofill suggestions.
   *
   * @see https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html
   * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
   * @example 'email' // For email address fields
   * @example 'given-name' // For first name fields
   * @example 'off' // Disable autocomplete
   */
  autocomplete?: ConditionalString

  /**
   * Attribute to provide a regular expression pattern for input validation.
   * Used to match allowed character combinations for the input value.
   *
   * @see https://html.spec.whatwg.org/multipage/input.html#the-pattern-attribute
   * @example '[0-9]*' // Only allow digits
   * @example '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' // Basic email pattern
   */
  pattern?: ConditionalString

  /**
   * Optional field to enable or disable the spellcheck attribute on the input.
   * When not specified, browsers will use their default behavior.
   * @example true // Enable spellcheck
   * @example false // Disable spellcheck (useful for usernames, codes, etc.)
   */
  spellcheck?: ConditionalBoolean

  /**
   * Optional field to enable or disable autocapitalisation of user input.
   *
   * @see https://html.spec.whatwg.org/multipage/interaction.html#autocapitalization
   * @example 'words' // Capitalize first letter of each word
   * @example 'sentences' // Capitalize first letter of each sentence
   * @example 'off' // Disable autocapitalization
   */
  autocapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'

  /**
   * Can be used to add a prefix to the text input component.
   * Useful for currency symbols, units, or other contextual indicators.
   *
   * @example { text: '£' } // Currency prefix
   * @example { html: '<span aria-hidden="true">@</span>' } // Username prefix
   */
  prefix?: {
    /** Text content of the prefix (takes precedence over html if both provided) */
    text?: ConditionalString
    /** HTML content of the prefix */
    html?: ConditionalString
    /** Additional CSS classes for the prefix */
    classes?: ConditionalString
    /** Additional HTML attributes for the prefix element */
    attributes?: Record<string, any>
  }

  /**
   * Can be used to add a suffix to the text input component.
   * Useful for units of measurement, file extensions, or other contextual indicators.
   *
   * @example { text: 'kg' } // Weight unit suffix
   * @example { text: '.gov.uk' } // Domain suffix
   */
  suffix?: {
    /** Text content of the suffix */
    text?: ConditionalString
    /** HTML content of the suffix (takes precedence over text) */
    html?: ConditionalString
    /** Additional CSS classes for the suffix element */
    classes?: ConditionalString
    /** Additional HTML attributes for the suffix element */
    attributes?: Record<string, any>
  }

  /**
   * Additional options for the form group containing the text input component.
   * Allows customization of the wrapper element and additional content.
   */
  formGroup?: {
    /**
     * Classes to add to the form group wrapper.
     * Useful for custom styling or indicating error states.
     */
    classes?: ConditionalString
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /**
     * Content to add before the input element.
     * Useful for additional instructions or related content.
     */
    beforeInput?: {
      /** Text content to add before the input */
      text?: ConditionalString
      /** HTML content to add before the input (takes precedence over text) */
      html?: ConditionalString
    }
    /**
     * Content to add after the input element.
     * Useful for format examples or related actions.
     */
    afterInput?: {
      /** Text content to add after the input */
      text?: ConditionalString
      /** HTML content to add after the input (takes precedence over text) */
      html?: ConditionalString
    }
  }

  /**
   * If any of prefix, suffix, formGroup.beforeInput or formGroup.afterInput have a value,
   * a wrapping element is added around the input and inserted content.
   * This allows customization of that wrapping element.
   */
  inputWrapper?: {
    /** Additional CSS classes for the input wrapper element */
    classes?: ConditionalString
    /** Additional HTML attributes for the input wrapper element */
    attributes?: Record<string, any>
  }

  /**
   * Additional CSS classes to add to the input element.
   * @example 'govuk-input--width-20' // Fixed width input
   * @example 'js-character-count' // For character counting functionality
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes (such as data attributes) to add to the input element.
   * @example { 'data-module': 'character-count', 'data-maxlength': '100' }
   * @example { 'aria-describedby': 'additional-help-text' }
   */
  attributes?: Record<string, any>
}

export const govukTextInput = buildNunjucksComponent<GovUKTextInput>('govukTextInput', async (block, nunjucksEnv) => {
  const params = {
    id: block.id ?? block.code,
    name: block.code,
    label: block.label ? (typeof block.label === 'object' ? block.label : { text: block.label }) : undefined,
    hint: block.hint ? (typeof block.hint === 'object' ? block.hint : { text: block.hint }) : undefined,
    value: block.value,
    type: block.inputType ?? 'text',
    inputmode: block.inputMode,
    disabled: block.disabled,
    autocomplete: block.autocomplete,
    pattern: block.pattern,
    spellcheck: block.spellcheck,
    autocapitalize: block.autocapitalize,
    prefix: block.prefix,
    suffix: block.suffix,
    formGroup: block.formGroup,
    inputWrapper: block.inputWrapper,
    classes: block.classes,
    attributes: block.attributes,
    errorMessage: block.errors?.length && { text: block.errors[0].message },
  }

  return nunjucksEnv.render('govuk/components/input/template.njk', {
    params,
  })
})

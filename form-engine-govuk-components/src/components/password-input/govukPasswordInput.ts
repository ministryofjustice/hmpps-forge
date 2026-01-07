import {
  ConditionalBoolean,
  ConditionalString,
  FieldBlockDefinition,
  FieldBlockProps,
} from '@form-engine/form/types/structures.type'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import { field } from '@form-engine/form/builders'

/**
 * Props for the GovUKPasswordInput component.
 * @see https://design-system.service.gov.uk/components/password-input/
 */
export interface GovUKPasswordInputProps extends FieldBlockProps {
  /**
   * The ID of the input. Defaults to the value of `code` if not provided.
   * @example 'user-password'
   */
  id?: ConditionalString

  /**
   * The label used by the password input component.
   * Can be a simple string or a complex object with additional properties.
   *
   * @example 'Password' // Simple string label
   * @example { text: 'Create a password', classes: 'govuk-label--l' } // Object with styling
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
   * Can be used to add a hint to the password input component.
   * Provides additional context or instructions for the user.
   *
   * @example 'Your password must be at least 8 characters' // Simple hint
   * @example { html: 'It must contain at least one <strong>number</strong>' } // Rich HTML hint
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
   * If `true`, input will be disabled and cannot be edited by the user.
   * @example true // Disable the input
   */
  disabled?: ConditionalBoolean

  /**
   * Attribute to meet WCAG success criterion 1.3.5: Identify input purpose.
   * Helps browsers provide appropriate autofill suggestions.
   * Defaults to 'current-password' if not specified.
   *
   * @see https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html
   * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
   * @example 'current-password' // For login forms
   * @example 'new-password' // For registration or password change forms
   */
  autocomplete?: ConditionalString

  /**
   * One or more element IDs to add to the `aria-describedby` attribute.
   * Used to provide additional descriptive information for screenreader users.
   *
   * @example 'password-requirements'
   */
  describedBy?: ConditionalString

  /**
   * Additional options for the form group containing the password input component.
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
     * Note: The show/hide toggle button is always rendered after the input.
     * Any afterInput content will be rendered after the toggle button.
     */
    afterInput?: {
      /** Text content to add after the input */
      text?: ConditionalString
      /** HTML content to add after the input (takes precedence over text) */
      html?: ConditionalString
    }
  }

  /**
   * Additional CSS classes to add to the input element.
   * @example 'govuk-input--width-20' // Fixed width input
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes (such as data attributes) to add to the input element.
   * @example { 'data-custom': 'value' }
   */
  attributes?: Record<string, any>

  /**
   * Button text when the password is hidden.
   * Defaults to 'Show'.
   *
   * @example 'Show password'
   */
  showPasswordText?: ConditionalString

  /**
   * Button text when the password is visible.
   * Defaults to 'Hide'.
   *
   * @example 'Hide password'
   */
  hidePasswordText?: ConditionalString

  /**
   * Button text exposed to assistive technologies, like screen readers,
   * when the password is hidden.
   * Defaults to 'Show password'.
   *
   * @example 'Show your password'
   */
  showPasswordAriaLabelText?: ConditionalString

  /**
   * Button text exposed to assistive technologies, like screen readers,
   * when the password is visible.
   * Defaults to 'Hide password'.
   *
   * @example 'Hide your password'
   */
  hidePasswordAriaLabelText?: ConditionalString

  /**
   * Announcement made to screen reader users when their password
   * has become visible in plain text.
   * Defaults to 'Your password is visible'.
   *
   * @example 'Password shown'
   */
  passwordShownAnnouncementText?: ConditionalString

  /**
   * Announcement made to screen reader users when their password
   * has been obscured and is not visible.
   * Defaults to 'Your password is hidden'.
   *
   * @example 'Password hidden'
   */
  passwordHiddenAnnouncementText?: ConditionalString

  /**
   * Optional object allowing customisation of the toggle button.
   */
  button?: {
    /** Additional CSS classes for the toggle button */
    classes?: ConditionalString
  }
}

export const govukPasswordInput = buildNunjucksComponent<GovUKPasswordInput>(
  'govukPasswordInput',
  async (block, nunjucksEnv) => {
    const params = {
      id: block.id ?? block.code,
      name: block.code,
      label: block.label ? (typeof block.label === 'object' ? block.label : { text: block.label }) : undefined,
      hint: block.hint ? (typeof block.hint === 'object' ? block.hint : { text: block.hint }) : undefined,
      value: block.value,
      disabled: block.disabled,
      autocomplete: block.autocomplete,
      describedBy: block.describedBy,
      formGroup: block.formGroup,
      classes: block.classes,
      attributes: block.attributes,
      showPasswordText: block.showPasswordText,
      hidePasswordText: block.hidePasswordText,
      showPasswordAriaLabelText: block.showPasswordAriaLabelText,
      hidePasswordAriaLabelText: block.hidePasswordAriaLabelText,
      passwordShownAnnouncementText: block.passwordShownAnnouncementText,
      passwordHiddenAnnouncementText: block.passwordHiddenAnnouncementText,
      button: block.button,
      errorMessage: block.errors?.length && { text: block.errors[0].message },
    }

    return nunjucksEnv.render('govuk/components/password-input/template.njk', {
      params,
    })
  },
)

/**
 * GOV.UK Password Input Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKPasswordInputProps` type or the `GovUKPasswordInput()` wrapper function instead.
 */
export interface GovUKPasswordInput extends FieldBlockDefinition, GovUKPasswordInputProps {
  /** Component variant identifier */
  variant: 'govukPasswordInput'
}

/**
 * Creates a GOV.UK Password Input field.
 * A password input component with a show/hide toggle following the GOV.UK Design System patterns.
 *
 * The password input component allows users to enter a password with a toggle button
 * to show or hide the password text. This helps users check they have typed their
 * password correctly, particularly on mobile devices.
 *
 * @see https://design-system.service.gov.uk/components/password-input/
 * @example
 * ```typescript
 * GovUKPasswordInput({
 *   code: 'password',
 *   label: 'Password',
 *   hint: 'Your password must be at least 8 characters',
 *   autocomplete: 'current-password',
 * })
 * ```
 * @example
 * ```typescript
 * // For new password creation (e.g., registration)
 * GovUKPasswordInput({
 *   code: 'new-password',
 *   label: { text: 'Create a password', isPageHeading: true },
 *   hint: 'Your password must contain at least 8 characters, a number, and a special character',
 *   autocomplete: 'new-password',
 * })
 * ```
 */
export function GovUKPasswordInput(props: GovUKPasswordInputProps): GovUKPasswordInput {
  return field<GovUKPasswordInput>({ ...props, variant: 'govukPasswordInput' })
}

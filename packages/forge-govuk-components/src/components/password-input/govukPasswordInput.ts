import { z } from 'zod'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukErrorMessage, normaliseGovukTextParam } from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Password Input component.
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
export interface GovUKPasswordInput {
  /**
   * The ID of the input. Defaults to the value of `code` if not provided.
   * @example 'user-password'
   */
  id?: string

  /**
   * The label used by the password input component.
   * Can be a simple string or a complex object with additional properties.
   *
   * @example 'Password' // Simple string label
   * @example { text: 'Create a password', classes: 'govuk-label--l' } // Object with styling
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
   * Can be used to add a hint to the password input component.
   * Provides additional context or instructions for the user.
   *
   * @example 'Your password must be at least 8 characters' // Simple hint
   * @example { html: 'It must contain at least one <strong>number</strong>' } // Rich HTML hint
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
   * If `true`, input will be disabled and cannot be edited by the user.
   * @example true // Disable the input
   */
  disabled?: boolean

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
  autocomplete?: string

  /**
   * One or more element IDs to add to the `aria-describedby` attribute.
   * Used to provide additional descriptive information for screenreader users.
   *
   * @example 'password-requirements'
   */
  describedBy?: string

  /**
   * Additional options for the form group containing the password input component.
   * Allows customization of the wrapper element and additional content.
   */
  formGroup?: {
    /**
     * Classes to add to the form group wrapper.
     * Useful for custom styling or indicating error states.
     */
    classes?: string
    /** HTML attributes to add to the form group wrapper */
    attributes?: Record<string, any>
    /**
     * Content to add before the input element.
     * Useful for additional instructions or related content.
     */
    beforeInput?: {
      /** Text content to add before the input */
      text?: string
      /** HTML content to add before the input (takes precedence over text) */
      html?: string
    }
    /**
     * Content to add after the input element.
     * Note: The show/hide toggle button is always rendered after the input.
     * Any afterInput content will be rendered after the toggle button.
     */
    afterInput?: {
      /** Text content to add after the input */
      text?: string
      /** HTML content to add after the input (takes precedence over text) */
      html?: string
    }
  }

  /**
   * Additional CSS classes to add to the input element.
   * @example 'govuk-input--width-20' // Fixed width input
   */
  classes?: string

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
  showPasswordText?: string

  /**
   * Button text when the password is visible.
   * Defaults to 'Hide'.
   *
   * @example 'Hide password'
   */
  hidePasswordText?: string

  /**
   * Button text exposed to assistive technologies, like screen readers,
   * when the password is hidden.
   * Defaults to 'Show password'.
   *
   * @example 'Show your password'
   */
  showPasswordAriaLabelText?: string

  /**
   * Button text exposed to assistive technologies, like screen readers,
   * when the password is visible.
   * Defaults to 'Hide password'.
   *
   * @example 'Hide your password'
   */
  hidePasswordAriaLabelText?: string

  /**
   * Announcement made to screen reader users when their password
   * has become visible in plain text.
   * Defaults to 'Your password is visible'.
   *
   * @example 'Password shown'
   */
  passwordShownAnnouncementText?: string

  /**
   * Announcement made to screen reader users when their password
   * has been obscured and is not visible.
   * Defaults to 'Your password is hidden'.
   *
   * @example 'Password hidden'
   */
  passwordHiddenAnnouncementText?: string

  /**
   * Optional object allowing customisation of the toggle button.
   */
  button?: {
    /** Additional CSS classes for the toggle button */
    classes?: string
  }
}

/**
 * GOV.UK Password Input component.
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
export const GovUKPasswordInput = nunjucksComponent<GovUKPasswordInput>('govukPasswordInput', {
  field: true,
  inputSchema: z.string(),
  // The rendered input's id matches the render params below, so error summary links land on it.
  errorAnchor: props => props.id ?? props.code,
  render: (props, nunjucksEnv) => {
    const params = {
      id: props.id ?? props.code,
      name: props.code,
      label: normaliseGovukTextParam(props.label),
      hint: normaliseGovukTextParam(props.hint),
      value: props.value,
      disabled: props.disabled,
      autocomplete: props.autocomplete,
      describedBy: props.describedBy,
      formGroup: props.formGroup,
      classes: props.classes,
      attributes: props.attributes,
      showPasswordText: props.showPasswordText,
      hidePasswordText: props.hidePasswordText,
      showPasswordAriaLabelText: props.showPasswordAriaLabelText,
      hidePasswordAriaLabelText: props.hidePasswordAriaLabelText,
      passwordShownAnnouncementText: props.passwordShownAnnouncementText,
      passwordHiddenAnnouncementText: props.passwordHiddenAnnouncementText,
      button: props.button,
      errorMessage: normaliseGovukErrorMessage(props.errors),
    }

    return nunjucksEnv.render('govuk/components/password-input/template.njk', {
      params,
    })
  },
})

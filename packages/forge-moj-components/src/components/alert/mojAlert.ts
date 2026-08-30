import { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseMojTextHtmlContent } from '../../utils/mojParamNormalisers'

/**
 * Alert variant types that determine styling and icon.
 */
export type MOJAlertVariant = 'information' | 'success' | 'warning' | 'error'

/**
 * Valid heading tag levels for the alert title.
 */
export type MOJAlertHeadingTag = 'h2' | 'h3' | 'h4'

/**
 * MOJ Alert component.
 * Displays important messages to users as a notification banner.
 * It supports different variants for different types of messages
 * (information, success, warning, error) and can be dismissible.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/alert
 * @example
 * ```typescript
 * MOJAlert({
 *   alertVariant: 'success',
 *   title: 'Application submitted',
 *   text: 'Your changes have been saved successfully.',
 *   showTitleAsHeading: true,
 * })
 * ```
 */
export interface MOJAlert {
  /**
   * The type of alert which determines styling and icon.
   * Options: 'information' (default), 'success', 'warning', 'error'
   *
   * @example 'information' // Blue info alert
   * @example 'success' // Green success alert
   * @example 'warning' // Yellow warning alert
   * @example 'error' // Red error alert
   */
  alertVariant?: MOJAlertVariant

  /**
   * The title of the alert. Used for the aria-label and optionally as a heading.
   *
   * @example 'Important information'
   * @example 'Application submitted'
   */
  title: string

  /**
   * Plain text content for the alert message.
   * Use either text or html, not both.
   *
   * @example 'Your application has been received.'
   */
  text?: string

  /**
   * HTML content for the alert message.
   * Use either text or html, not both.
   *
   * @example '<p>You have <strong>unsaved changes</strong>.</p>'
   */
  html?: string

  /**
   * Child blocks to render in the alert message.
   * Takes precedence over text/html.
   */
  blocks?: BlockDefinition[]

  /**
   * Whether to display the title as a heading element.
   * When true, the title appears as a heading above the content.
   *
   * @example true // Show title as heading
   */
  showTitleAsHeading?: boolean

  /**
   * The heading level when showTitleAsHeading is true.
   * Options: 'h2' (default), 'h3', 'h4'
   *
   * @example 'h2' // Default heading level
   * @example 'h3' // Smaller heading
   */
  headingTag?: MOJAlertHeadingTag

  /**
   * Whether the alert can be dismissed by the user.
   * When true, a dismiss button is shown.
   *
   * @example true // Show dismiss button
   */
  dismissible?: boolean

  /**
   * Text for the dismiss button.
   * Default: 'Dismiss'
   *
   * @example 'Close'
   * @example 'Hide this message'
   */
  dismissText?: string

  /**
   * Whether to disable auto-focus on the alert when it appears.
   *
   * @example true // Disable auto-focus
   */
  disableAutoFocus?: boolean

  /**
   * CSS selector for the element to focus when the alert is dismissed.
   *
   * @example '#main-content'
   */
  focusOnDismissSelector?: string

  /**
   * ARIA role for the alert container.
   * Default: 'region'
   *
   * @example 'alert' // For urgent notifications
   * @example 'status' // For status updates
   */
  role?: string

  /**
   * Additional CSS classes for the alert container.
   *
   * @example 'app-alert--custom'
   */
  classes?: string

  /**
   * Additional HTML attributes for the alert container.
   *
   * @example { 'data-module': 'custom-alert' }
   */
  attributes?: Record<string, string>
}

/**
 * MOJ Alert component.
 * Displays important messages to users as a notification banner.
 * It supports different variants for different types of messages
 * (information, success, warning, error) and can be dismissible.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/alert
 * @example
 * ```typescript
 * MOJAlert({
 *   alertVariant: 'success',
 *   title: 'Application submitted',
 *   text: 'Your changes have been saved successfully.',
 *   showTitleAsHeading: true,
 * })
 * ```
 */
export const MOJAlert = nunjucksComponent<MOJAlert>('mojAlert', {
  factory:
    ({ nunjucksEnv }) =>
    ({ props }) => {
      const content = normaliseMojTextHtmlContent({
        text: props.text,
        html: props.html,
        blocks: props.blocks,
      })
      const params = {
        variant: props.alertVariant,
        title: props.title,
        text: content.text,
        html: content.html,
        showTitleAsHeading: props.showTitleAsHeading,
        headingTag: props.headingTag,
        dismissible: props.dismissible,
        dismissText: props.dismissText,
        disableAutoFocus: props.disableAutoFocus,
        focusOnDismissSelector: props.focusOnDismissSelector,
        role: props.role,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('moj/components/alert/template.njk', { params })
    },
})

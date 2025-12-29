import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Alert variant types that determine styling and icon.
 */
export type MOJAlertVariant = 'information' | 'success' | 'warning' | 'error'

/**
 * Valid heading tag levels for the alert title.
 */
export type MOJAlertHeadingTag = 'h2' | 'h3' | 'h4'

/**
 * Props for the MOJAlert component.
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
export interface MOJAlertProps extends BasicBlockProps {
  /**
   * The type of alert which determines styling and icon.
   * Options: 'information' (default), 'success', 'warning', 'error'
   *
   * @example 'information' // Blue info alert
   * @example 'success' // Green success alert
   * @example 'warning' // Yellow warning alert
   * @example 'error' // Red error alert
   */
  alertVariant?: MOJAlertVariant | ConditionalString

  /**
   * The title of the alert. Used for the aria-label and optionally as a heading.
   *
   * @example 'Important information'
   * @example 'Application submitted'
   */
  title: ConditionalString

  /**
   * Plain text content for the alert message.
   * Use either text or html, not both.
   *
   * @example 'Your application has been received.'
   */
  text?: ConditionalString

  /**
   * HTML content for the alert message.
   * Use either text or html, not both.
   *
   * @example '<p>You have <strong>unsaved changes</strong>.</p>'
   */
  html?: ConditionalString

  /**
   * Whether to display the title as a heading element.
   * When true, the title appears as a heading above the content.
   *
   * @example true // Show title as heading
   */
  showTitleAsHeading?: ConditionalBoolean

  /**
   * The heading level when showTitleAsHeading is true.
   * Options: 'h2' (default), 'h3', 'h4'
   *
   * @example 'h2' // Default heading level
   * @example 'h3' // Smaller heading
   */
  headingTag?: MOJAlertHeadingTag | ConditionalString

  /**
   * Whether the alert can be dismissed by the user.
   * When true, a dismiss button is shown.
   *
   * @example true // Show dismiss button
   */
  dismissible?: ConditionalBoolean

  /**
   * Text for the dismiss button.
   * Default: 'Dismiss'
   *
   * @example 'Close'
   * @example 'Hide this message'
   */
  dismissText?: ConditionalString

  /**
   * Whether to disable auto-focus on the alert when it appears.
   *
   * @example true // Disable auto-focus
   */
  disableAutoFocus?: ConditionalBoolean

  /**
   * CSS selector for the element to focus when the alert is dismissed.
   *
   * @example '#main-content'
   */
  focusOnDismissSelector?: ConditionalString

  /**
   * ARIA role for the alert container.
   * Default: 'region'
   *
   * @example 'alert' // For urgent notifications
   * @example 'status' // For status updates
   */
  role?: ConditionalString

  /**
   * Additional CSS classes for the alert container.
   *
   * @example 'app-alert--custom'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the alert container.
   *
   * @example { 'data-module': 'custom-alert' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Alert Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJAlertProps` type or the `MOJAlert()` wrapper function instead.
 */
export interface MOJAlert extends BlockDefinition, MOJAlertProps {
  /** Component variant identifier */
  variant: 'mojAlert'
}

/**
 * Renders an MOJ Alert component using Nunjucks template
 */
async function alertRenderer(block: EvaluatedBlock<MOJAlert>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params = {
    variant: block.alertVariant,
    title: block.title,
    text: block.text,
    html: block.html,
    showTitleAsHeading: block.showTitleAsHeading,
    headingTag: block.headingTag,
    dismissible: block.dismissible,
    dismissText: block.dismissText,
    disableAutoFocus: block.disableAutoFocus,
    focusOnDismissSelector: block.focusOnDismissSelector,
    role: block.role,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/alert/template.njk', { params })
}

export const mojAlert = buildNunjucksComponent<MOJAlert>('mojAlert', alertRenderer)

/**
 * Creates an MOJ Alert block for displaying notification banners.
 *
 * The alert component is used to display important messages to users.
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
export function MOJAlert(props: MOJAlertProps): MOJAlert {
  return blockBuilder<MOJAlert>({ ...props, variant: 'mojAlert' })
}

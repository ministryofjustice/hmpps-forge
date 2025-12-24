import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'

/**
 * Alert variant types that determine styling and icon.
 */
export type MOJAlertVariant = 'information' | 'success' | 'warning' | 'error'

/**
 * Valid heading tag levels for the alert title.
 */
export type MOJAlertHeadingTag = 'h2' | 'h3' | 'h4'

/**
 * MOJ Alert component for displaying notification banners.
 *
 * Based on the MOJ Design Patterns alert component:
 * https://design-patterns.service.justice.gov.uk/components/alert
 *
 * The alert component is used to display important messages to users.
 * It supports different variants for different types of messages
 * (information, success, warning, error) and can be dismissible.
 *
 * @example
 * ```typescript
 * // Simple information alert
 * block<MOJAlert>({
 *   variant: 'mojAlert',
 *   alertVariant: 'information',
 *   title: 'Important information',
 *   text: 'Your application has been received.',
 * })
 *
 * // Success alert with heading
 * block<MOJAlert>({
 *   variant: 'mojAlert',
 *   alertVariant: 'success',
 *   title: 'Application submitted',
 *   text: 'Your changes have been saved successfully.',
 *   showTitleAsHeading: true,
 * })
 *
 * // Dismissible warning alert
 * block<MOJAlert>({
 *   variant: 'mojAlert',
 *   alertVariant: 'warning',
 *   title: 'Warning',
 *   html: '<p>You have <strong>unsaved changes</strong>.</p>',
 *   dismissible: true,
 *   dismissText: 'Close',
 * })
 *
 * // Error alert
 * block<MOJAlert>({
 *   variant: 'mojAlert',
 *   alertVariant: 'error',
 *   title: 'There is a problem',
 *   text: 'The service is currently unavailable.',
 * })
 * ```
 */
export interface MOJAlert extends BlockDefinition {
  variant: 'mojAlert'

  /**
   * The type of alert which determines styling and icon.
   * Options: 'information' (default), 'success', 'warning', 'error'
   */
  alertVariant?: MOJAlertVariant | ConditionalString

  /**
   * The title of the alert. Used for the aria-label and optionally as a heading.
   */
  title: ConditionalString

  /**
   * Plain text content for the alert message.
   * Use either text or html, not both.
   */
  text?: ConditionalString

  /**
   * HTML content for the alert message.
   * Use either text or html, not both.
   */
  html?: ConditionalString

  /**
   * Whether to display the title as a heading element.
   * When true, the title appears as a heading above the content.
   */
  showTitleAsHeading?: ConditionalBoolean

  /**
   * The heading level when showTitleAsHeading is true.
   * Options: 'h2' (default), 'h3', 'h4'
   */
  headingTag?: MOJAlertHeadingTag | ConditionalString

  /**
   * Whether the alert can be dismissed by the user.
   * When true, a dismiss button is shown.
   */
  dismissible?: ConditionalBoolean

  /**
   * Text for the dismiss button.
   * Default: 'Dismiss'
   */
  dismissText?: ConditionalString

  /**
   * Whether to disable auto-focus on the alert when it appears.
   */
  disableAutoFocus?: ConditionalBoolean

  /**
   * CSS selector for the element to focus when the alert is dismissed.
   */
  focusOnDismissSelector?: ConditionalString

  /**
   * ARIA role for the alert container.
   * Default: 'region'
   */
  role?: ConditionalString

  /**
   * Additional CSS classes for the alert container.
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the alert container.
   */
  attributes?: Record<string, ConditionalString>
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

import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalBoolean,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Props for the GovUKNotificationBanner component.
 *
 * Use this to display important notifications to users, such as success messages
 * or important information they need to know about. Follows the GOV.UK Design System patterns.
 *
 * @see https://design-system.service.gov.uk/components/notification-banner/
 * @example
 * ```typescript
 * // Basic important notification
 * GovUKNotificationBanner({
 *   text: 'You have 7 days left to send your application.',
 * })
 *
 * // Success notification
 * GovUKNotificationBanner({
 *   bannerType: 'success',
 *   text: 'Training outcome recorded and trainee withdrawn',
 * })
 * ```
 */
export interface GovUKNotificationBannerProps extends BasicBlockProps {
  /**
   * The text that displays in the notification banner.
   * You can use any string with this option.
   * If you set `html`, this option is not required and is ignored.
   */
  text?: ConditionalString

  /**
   * The HTML to use within the notification banner.
   * You can use any string with this option.
   * If you set `html`, `text` is not required and is ignored.
   */
  html?: ConditionalString

  /**
   * Child blocks to render in the notification banner content area.
   * Takes precedence over text/html.
   */
  content?: BlockDefinition[]

  /**
   * The title text that displays in the notification banner.
   * You can use any string with this option.
   * Use this option to set text that does not contain HTML.
   *
   * The available default values are 'Important', 'Success', and null:
   * - if you do not set `bannerType`, `titleText` defaults to "Important"
   * - if you set `bannerType` to "success", `titleText` defaults to "Success"
   * - if you set `titleHtml`, this option is ignored
   */
  titleText?: ConditionalString

  /**
   * The title HTML to use within the notification banner.
   * You can use any string with this option.
   * Use this option to set text that contains HTML.
   * If you set `titleHtml`, the `titleText` option is ignored.
   */
  titleHtml?: ConditionalString

  /**
   * Sets heading level for the title only.
   * You can only use values between 1 and 6 with this option.
   * The default is 2.
   */
  titleHeadingLevel?: ConditionalString

  /**
   * The type of notification to render.
   * You can use only "success" or null values with this option.
   *
   * If you set `bannerType` to "success", the notification banner sets `role` to "alert".
   * JavaScript then moves the keyboard focus to the notification banner when the page loads.
   *
   * If you do not set `bannerType`, the notification banner sets `role` to "region".
   *
   * Note: This property is named `bannerType` instead of `type` to avoid conflict
   * with the form-engine block definition type discriminator.
   */
  bannerType?: ConditionalString

  /**
   * Overrides the value of the `role` attribute for the notification banner.
   * Defaults to "region".
   * If you set `bannerType` to "success", `role` defaults to "alert".
   */
  role?: ConditionalString

  /**
   * The `id` for the banner title, and the `aria-labelledby` attribute in the banner.
   * Defaults to "govuk-notification-banner-title".
   */
  titleId?: ConditionalString

  /**
   * If you set `bannerType` to "success", or `role` to "alert", JavaScript moves
   * the keyboard focus to the notification banner when the page loads.
   * To disable this behaviour, set `disableAutoFocus` to true.
   */
  disableAutoFocus?: ConditionalBoolean

  /** Additional CSS classes for the notification banner container */
  classes?: ConditionalString

  /** Custom HTML attributes for the notification banner container */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Notification Banner component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKNotificationBannerProps` type or the `GovUKNotificationBanner()` wrapper function instead.
 */
export interface GovUKNotificationBanner extends BlockDefinition, GovUKNotificationBannerProps {
  /** Component variant identifier */
  variant: 'govukNotificationBanner'
}

/**
 * Renders the GOV.UK Notification Banner component using the official Nunjucks template.
 */
async function notificationBannerRenderer(
  block: EvaluatedBlock<GovUKNotificationBanner>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  // If content blocks are provided, render them and use as HTML
  let contentHtml: string | undefined

  if (block.content && block.content.length > 0) {
    contentHtml = block.content.map(b => b.html).join('')
  }

  const params: Record<string, any> = {
    text: contentHtml || block.html ? undefined : block.text,
    html: contentHtml || block.html,
    titleText: block.titleHtml ? undefined : block.titleText,
    titleHtml: block.titleHtml,
    titleHeadingLevel: block.titleHeadingLevel,
    type: block.bannerType,
    role: block.role,
    titleId: block.titleId,
    disableAutoFocus: block.disableAutoFocus,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/notification-banner/template.njk', { params })
}

export const govukNotificationBanner = buildNunjucksComponent<GovUKNotificationBanner>(
  'govukNotificationBanner',
  notificationBannerRenderer as any,
)

/**
 * Creates a GOV.UK Notification Banner block for displaying important notifications.
 * Use this to show success messages or important information to users.
 *
 * @see https://design-system.service.gov.uk/components/notification-banner/
 * @example
 * ```typescript
 * // Basic important notification
 * GovUKNotificationBanner({
 *   text: 'You have 7 days left to send your application.',
 * })
 *
 * // Success notification
 * GovUKNotificationBanner({
 *   bannerType: 'success',
 *   text: 'Training outcome recorded and trainee withdrawn',
 * })
 *
 * // With custom title
 * GovUKNotificationBanner({
 *   titleText: 'Application received',
 *   text: 'We will review your application and get back to you within 5 working days.',
 * })
 * ```
 */
export function GovUKNotificationBanner(props: GovUKNotificationBannerProps): GovUKNotificationBanner {
  return blockBuilder<GovUKNotificationBanner>({ ...props, variant: 'govukNotificationBanner' })
}

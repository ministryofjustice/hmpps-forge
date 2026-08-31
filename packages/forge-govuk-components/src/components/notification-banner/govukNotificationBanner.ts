import { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Notification Banner component.
 *
 * Use this to display important notifications to users, such as success messages
 * or important information they need to know about.
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
export interface GovUKNotificationBanner {
  /**
   * The text that displays in the notification banner.
   * You can use any string with this option.
   * If you set `html`, this option is not required and is ignored.
   */
  text?: string

  /**
   * The HTML to use within the notification banner.
   * You can use any string with this option.
   * If you set `html`, `text` is not required and is ignored.
   */
  html?: string

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
  titleText?: string

  /**
   * The title HTML to use within the notification banner.
   * You can use any string with this option.
   * Use this option to set text that contains HTML.
   * If you set `titleHtml`, the `titleText` option is ignored.
   */
  titleHtml?: string

  /**
   * Sets heading level for the title only.
   * You can only use values between 1 and 6 with this option.
   * The default is 2.
   */
  titleHeadingLevel?: string

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
   * with the forge block definition type discriminator.
   */
  bannerType?: string

  /**
   * Overrides the value of the `role` attribute for the notification banner.
   * Defaults to "region".
   * If you set `bannerType` to "success", `role` defaults to "alert".
   */
  role?: string

  /**
   * The `id` for the banner title, and the `aria-labelledby` attribute in the banner.
   * Defaults to "govuk-notification-banner-title".
   */
  titleId?: string

  /**
   * If you set `bannerType` to "success", or `role` to "alert", JavaScript moves
   * the keyboard focus to the notification banner when the page loads.
   * To disable this behaviour, set `disableAutoFocus` to true.
   */
  disableAutoFocus?: boolean

  /** Additional CSS classes for the notification banner container */
  classes?: string

  /** Custom HTML attributes for the notification banner container */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Notification Banner component.
 *
 * Use this to display important notifications to users, such as success messages
 * or important information they need to know about.
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
export const GovUKNotificationBanner = nunjucksComponent<GovUKNotificationBanner>('govukNotificationBanner', {
  factory:
    ({ nunjucksEnv }) =>
    props => {
      const content = normaliseGovukTextHtmlContent({
        text: props.text,
        html: props.html,
        blocks: props.content,
      })
      const params: Record<string, any> = {
        text: content.text,
        html: content.html,
        titleText: props.titleHtml ? undefined : props.titleText,
        titleHtml: props.titleHtml,
        titleHeadingLevel: props.titleHeadingLevel,
        type: props.bannerType,
        role: props.role,
        titleId: props.titleId,
        disableAutoFocus: props.disableAutoFocus,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('govuk/components/notification-banner/template.njk', { params })
    },
})

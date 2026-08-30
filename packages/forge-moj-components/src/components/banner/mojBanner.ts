import { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseMojTextHtmlContent } from '../../utils/mojParamNormalisers'

/**
 * Banner type that determines styling and icon.
 */
export type MOJBannerType = 'success' | 'warning' | 'information'

/**
 * MOJ Banner component.
 * Displays important messages to users.
 * It supports different types for different kinds of messages
 * (success, warning, information) with corresponding icons.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/banner
 * @example
 * ```typescript
 * MOJBanner({
 *   bannerType: 'success',
 *   text: 'Your application has been submitted.',
 * })
 * ```
 */
export interface MOJBanner {
  /**
   * The type of banner which determines styling and icon.
   * Options: 'success', 'warning', 'information'
   * If not specified, renders a default banner without icon.
   *
   * @example 'success' // Green banner with checkmark icon
   * @example 'warning' // Yellow banner with warning icon
   * @example 'information' // Blue banner with info icon
   */
  bannerType?: MOJBannerType

  /**
   * Plain text content for the banner message.
   * Use either text or html, not both.
   *
   * @example 'Your application has been submitted.'
   */
  text?: string

  /**
   * HTML content for the banner message.
   * Use either text or html, not both.
   *
   * @example '<p>Your application has been <strong>submitted</strong>.</p>'
   */
  html?: string

  /**
   * Child blocks to render in the banner message.
   * Takes precedence over text/html.
   */
  blocks?: BlockDefinition[]

  /**
   * Fallback text for the icon used in the aria-label.
   * Defaults to the bannerType value if not provided.
   *
   * @example 'Success'
   * @example 'Warning'
   */
  iconFallbackText?: string

  /**
   * Additional CSS classes for the banner container.
   *
   * @example 'app-banner--custom'
   */
  classes?: string

  /**
   * Additional HTML attributes for the banner container.
   *
   * @example { 'data-module': 'custom-banner' }
   */
  attributes?: Record<string, string>
}

/**
 * MOJ Banner component.
 * Displays important messages to users.
 * It supports different types for different kinds of messages
 * (success, warning, information) with corresponding icons.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/banner
 * @example
 * ```typescript
 * MOJBanner({
 *   bannerType: 'success',
 *   text: 'Your application has been submitted.',
 * })
 * ```
 */
export const MOJBanner = nunjucksComponent<MOJBanner>('mojBanner', {
  factory:
    ({ nunjucksEnv }) =>
    ({ props }) => {
      const content = normaliseMojTextHtmlContent({
        text: props.text,
        html: props.html,
        blocks: props.blocks,
      })
      const params = {
        type: props.bannerType,
        text: content.text,
        html: content.html,
        iconFallbackText: props.iconFallbackText,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('moj/components/banner/template.njk', { params })
    },
})

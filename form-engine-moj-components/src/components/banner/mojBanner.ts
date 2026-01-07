import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Banner type that determines styling and icon.
 */
export type MOJBannerType = 'success' | 'warning' | 'information'

/**
 * Props for the MOJBanner component.
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
export interface MOJBannerProps extends BasicBlockProps {
  /**
   * The type of banner which determines styling and icon.
   * Options: 'success', 'warning', 'information'
   * If not specified, renders a default banner without icon.
   *
   * @example 'success' // Green banner with checkmark icon
   * @example 'warning' // Yellow banner with warning icon
   * @example 'information' // Blue banner with info icon
   */
  bannerType?: MOJBannerType | ConditionalString

  /**
   * Plain text content for the banner message.
   * Use either text or html, not both.
   *
   * @example 'Your application has been submitted.'
   */
  text?: ConditionalString

  /**
   * HTML content for the banner message.
   * Use either text or html, not both.
   *
   * @example '<p>Your application has been <strong>submitted</strong>.</p>'
   */
  html?: ConditionalString

  /**
   * Fallback text for the icon used in the aria-label.
   * Defaults to the bannerType value if not provided.
   *
   * @example 'Success'
   * @example 'Warning'
   */
  iconFallbackText?: ConditionalString

  /**
   * Additional CSS classes for the banner container.
   *
   * @example 'app-banner--custom'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the banner container.
   *
   * @example { 'data-module': 'custom-banner' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Banner Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJBannerProps` type or the `MOJBanner()` wrapper function instead.
 */
export interface MOJBanner extends BlockDefinition, MOJBannerProps {
  /** Component variant identifier */
  variant: 'mojBanner'
}

/**
 * Renders an MOJ Banner component using Nunjucks template
 */
async function bannerRenderer(block: EvaluatedBlock<MOJBanner>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params = {
    type: block.bannerType,
    text: block.text,
    html: block.html,
    iconFallbackText: block.iconFallbackText,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/banner/template.njk', { params })
}

export const mojBanner = buildNunjucksComponent<MOJBanner>('mojBanner', bannerRenderer)

/**
 * Creates an MOJ Banner block for displaying important messages.
 *
 * The banner component is used to display important messages to users.
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
export function MOJBanner(props: MOJBannerProps): MOJBanner {
  return blockBuilder<MOJBanner>({ ...props, variant: 'mojBanner' })
}

import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Props for the GovUKBackLink component.
 *
 * Use this to help users go back to the previous page in a multi-page transaction.
 * The back link should be placed at the top of the page, before the main content.
 *
 * @see https://design-system.service.gov.uk/components/back-link/
 * @example
 * ```typescript
 * GovUKBackLink({
 *   href: '/previous-page',
 * })
 * ```
 */
export interface GovUKBackLinkProps extends BasicBlockProps {
  /**
   * The value of the link's `href` attribute.
   * This is the URL that the user will be taken to when they click the back link.
   */
  href: ConditionalString

  /**
   * Plain text content for the back link.
   * Defaults to "Back" if neither `text` nor `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: ConditionalString

  /**
   * HTML content for the back link.
   * Takes precedence over `text` if both are provided.
   * Defaults to "Back" if neither `text` nor `html` is provided.
   */
  html?: ConditionalString

  /**
   * Additional CSS classes to add to the anchor tag.
   * Use this to apply custom styling or modifier classes.
   */
  classes?: ConditionalString

  /**
   * HTML attributes (for example data attributes) to add to the anchor tag.
   * Useful for adding custom data attributes or ARIA attributes.
   */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Back Link component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKBackLinkProps` type or the `GovUKBackLink()` wrapper function instead.
 */
export interface GovUKBackLink extends BlockDefinition, GovUKBackLinkProps {
  /** Component variant identifier */
  variant: 'govukBackLink'
}

/**
 * Renders the GOV.UK Back Link component using the official Nunjucks template.
 */
async function backLinkRenderer(
  block: EvaluatedBlock<GovUKBackLink>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    href: block.href,
    text: block.html ? undefined : block.text,
    html: block.html,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/back-link/template.njk', { params })
}

export const govukBackLink = buildNunjucksComponent<GovUKBackLink>('govukBackLink', backLinkRenderer)

/**
 * Creates a GOV.UK Back Link block for helping users navigate to the previous page.
 * Should be placed at the top of the page, before the main content.
 *
 * @see https://design-system.service.gov.uk/components/back-link/
 * @example
 * ```typescript
 * GovUKBackLink({
 *   href: '/previous-page',
 * })
 *
 * // With custom text
 * GovUKBackLink({
 *   href: '/dashboard',
 *   text: 'Return to dashboard',
 * })
 * ```
 */
export function GovUKBackLink(props: GovUKBackLinkProps): GovUKBackLink {
  return blockBuilder<GovUKBackLink>({ ...props, variant: 'govukBackLink' })
}

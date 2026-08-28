import { ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * GOV.UK Back Link component.
 *
 * Use this to help users go back to the previous page in a multi-page transaction.
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
export type GovUKBackLink = ResolvableBlockProps<{
  /**
   * The value of the link's `href` attribute.
   * This is the URL that the user will be taken to when they click the back link.
   */
  href: string

  /**
   * Plain text content for the back link.
   * Defaults to "Back" if neither `text` nor `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: string

  /**
   * HTML content for the back link.
   * Takes precedence over `text` if both are provided.
   * Defaults to "Back" if neither `text` nor `html` is provided.
   */
  html?: string

  /**
   * Additional CSS classes to add to the anchor tag.
   * Use this to apply custom styling or modifier classes.
   */
  classes?: string

  /**
   * HTML attributes (for example data attributes) to add to the anchor tag.
   * Useful for adding custom data attributes or ARIA attributes.
   */
  attributes?: Record<string, any>
}>

/**
 * GOV.UK Back Link component.
 *
 * Use this to help users go back to the previous page in a multi-page transaction.
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
export const GovUKBackLink = nunjucksComponent<GovUKBackLink>('govukBackLink', {
  render: (props, nunjucksEnv) => {
    const params: Record<string, any> = {
      href: props.href,
      text: props.html ? undefined : props.text,
      html: props.html,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/back-link/template.njk', { params })
  },
})

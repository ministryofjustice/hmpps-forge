import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Available badge colour classes.
 * Use these to style the badge appearance.
 */
export type MOJBadgeColour =
  | 'moj-badge--purple'
  | 'moj-badge--light-purple'
  | 'moj-badge--bright-purple'
  | 'moj-badge--pink'
  | 'moj-badge--light-pink'
  | 'moj-badge--red'
  | 'moj-badge--orange'
  | 'moj-badge--brown'
  | 'moj-badge--yellow'
  | 'moj-badge--light-green'
  | 'moj-badge--green'
  | 'moj-badge--turquoise'
  | 'moj-badge--light-blue'
  | 'moj-badge--blue'
  | 'moj-badge--black'
  | 'moj-badge--dark-grey'
  | 'moj-badge--mid-grey'
  | 'moj-badge--light-grey'
  | 'moj-badge--white'

/**
 * MOJ Badge component.
 * Displays small status or category labels.
 * It can be styled with different colours to indicate different states.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/badge
 * @example
 * ```typescript
 * MOJBadge({
 *   text: 'Urgent',
 *   classes: 'moj-badge--red',
 * })
 * ```
 *
 * @example
 * ```typescript
 * MOJBadge({
 *   text: 'Complete',
 *   classes: 'moj-badge--green',
 *   label: 'Status: Complete',
 * })
 * ```
 */
export interface MOJBadge {
  /**
   * Plain text content for the badge.
   * Use either text or html, not both.
   *
   * @example 'Complete'
   * @example 'In progress'
   */
  text?: string

  /**
   * HTML content for the badge.
   * Use either text or html, not both.
   *
   * @example '<strong>Urgent</strong>'
   */
  html?: string

  /**
   * CSS classes for the badge container.
   * Use moj-badge--{colour} classes to style the badge.
   *
   * @example 'moj-badge--blue'
   * @example 'moj-badge--red moj-badge--large'
   */
  classes?: MOJBadgeColour | string

  /**
   * Accessible label for the badge.
   * Sets the aria-label attribute for screen readers.
   *
   * @example 'Status: Complete'
   */
  label?: string

  /**
   * Additional HTML attributes for the badge container.
   *
   * @example { 'data-status': 'complete' }
   */
  attributes?: Record<string, string>
}

/**
 * MOJ Badge component.
 * Displays small status or category labels.
 * It can be styled with different colours to indicate different states.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/badge
 * @example
 * ```typescript
 * MOJBadge({
 *   text: 'Urgent',
 *   classes: 'moj-badge--red',
 * })
 * ```
 *
 * @example
 * ```typescript
 * MOJBadge({
 *   text: 'Complete',
 *   classes: 'moj-badge--green',
 *   label: 'Status: Complete',
 * })
 * ```
 */
export const MOJBadge = nunjucksComponent<MOJBadge>('mojBadge', {
  render: (props, nunjucksEnv) => {
    const params = {
      text: props.text,
      html: props.html,
      classes: props.classes,
      label: props.label,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/badge/template.njk', { params })
  },
})

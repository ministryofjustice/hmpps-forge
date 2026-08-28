import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Heading configuration for the MOJ Card component.
 */
export interface MOJCardHeading {
  /** Heading text (required if html not set) */
  text?: string

  /** Heading HTML content (required if text not set) */
  html?: string

  /** Heading level 1-6 (default: 2) */
  level?: 1 | 2 | 3 | 4 | 5 | 6

  /** Additional classes for the heading element */
  classes?: string
}

/**
 * Description configuration for the MOJ Card component.
 */
export interface MOJCardDescription {
  /** Description text (required if html not set) */
  text?: string

  /** Description HTML content (required if text not set) */
  html?: string

  /** Additional classes for the description element */
  classes?: string
}

/**
 * MOJ Card component.
 * A card component for displaying links on dashboards or home pages.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/card/
 * @example
 * ```typescript
 * MOJCard({
 *   heading: 'Search cases',
 *   href: '/cases/search',
 *   description: 'Find and manage case records',
 * })
 * ```
 */
export interface MOJCard {
  /**
   * Card heading - can be a simple string or object with additional options.
   * @example 'Search cases'
   * @example { text: 'Search cases', level: 3 }
   */
  heading: string | MOJCardHeading

  /** Link URL for the card heading */
  href: string

  /**
   * Optional description - can be a simple string or object with additional options.
   * @example 'Find and manage case records'
   * @example { html: '<strong>Find</strong> records' }
   */
  description?: string | MOJCardDescription

  /** Makes the entire card clickable via CSS (default: true) */
  clickable?: boolean

  /** Additional CSS classes for the card container */
  classes?: string

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

/**
 * MOJ Card component.
 * A card component for displaying links on dashboards or home pages.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/card/
 * @example
 * ```typescript
 * MOJCard({
 *   heading: 'Search cases',
 *   href: '/cases/search',
 *   description: 'Find and manage case records',
 * })
 * ```
 */
export const MOJCard = nunjucksComponent<MOJCard>('mojCard', {
  render: (props, nunjucksEnv) => {
    const params = {
      heading: typeof props.heading === 'object' ? props.heading : { text: props.heading },
      href: props.href,
      description: props.description
        ? typeof props.description === 'object'
          ? props.description
          : { text: props.description }
        : undefined,
      clickable: props.clickable,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('components/card/template.njk', { params })
  },
})

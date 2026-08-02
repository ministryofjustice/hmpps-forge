import {
  BlockDefinition,
  ResolvableBoolean,
  ResolvableObject,
  ResolvableString,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

/**
 * Heading configuration for the MOJ Card component.
 */
export interface MOJCardHeading {
  /** Heading text (required if html not set) */
  text?: ResolvableString

  /** Heading HTML content (required if text not set) */
  html?: ResolvableString

  /** Heading level 1-6 (default: 2) */
  level?: 1 | 2 | 3 | 4 | 5 | 6

  /** Additional classes for the heading element */
  classes?: ResolvableString
}

/**
 * Description configuration for the MOJ Card component.
 */
export interface MOJCardDescription {
  /** Description text (required if html not set) */
  text?: ResolvableString

  /** Description HTML content (required if text not set) */
  html?: ResolvableString

  /** Additional classes for the description element */
  classes?: ResolvableString
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
export interface MOJCard extends BlockDefinition {
  /**
   * Card heading - can be a simple string or object with additional options.
   * @example 'Search cases'
   * @example { text: 'Search cases', level: 3 }
   */
  heading: ResolvableString | ResolvableObject<MOJCardHeading>

  /** Link URL for the card heading */
  href: ResolvableString

  /**
   * Optional description - can be a simple string or object with additional options.
   * @example 'Find and manage case records'
   * @example { html: '<strong>Find</strong> records' }
   */
  description?: ResolvableString | ResolvableObject<MOJCardDescription>

  /** Makes the entire card clickable via CSS (default: true) */
  clickable?: ResolvableBoolean

  /** Additional CSS classes for the card container */
  classes?: ResolvableString

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

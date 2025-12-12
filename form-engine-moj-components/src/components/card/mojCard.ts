import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'

/**
 * Heading configuration for the MOJ Card component.
 */
export interface MOJCardHeading {
  /** Heading text (required if html not set) */
  text?: ConditionalString

  /** Heading HTML content (required if text not set) */
  html?: ConditionalString

  /** Heading level 1-6 (default: 2) */
  level?: 1 | 2 | 3 | 4 | 5 | 6

  /** Additional classes for the heading element */
  classes?: ConditionalString
}

/**
 * Description configuration for the MOJ Card component.
 */
export interface MOJCardDescription {
  /** Description text (required if html not set) */
  text?: ConditionalString

  /** Description HTML content (required if text not set) */
  html?: ConditionalString

  /** Additional classes for the description element */
  classes?: ConditionalString
}

/**
 * MOJ Card component for displaying links on dashboards or home pages.
 *
 * Based on the MOJ Design Patterns card component:
 * https://design-patterns.service.justice.gov.uk/components/card/
 *
 * Cards display a heading with a link and optional description text.
 * The clickable variant makes the entire card a click target using CSS.
 *
 * @example
 * ```typescript
 * // Simple form - just strings
 * block<MOJCard>({
 *   variant: 'mojCard',
 *   heading: 'Search cases',
 *   href: '/cases/search',
 *   description: 'Find and manage case records',
 * })
 *
 * // Full form - with additional options
 * block<MOJCard>({
 *   variant: 'mojCard',
 *   heading: { text: 'Search cases', level: 3, classes: 'custom-heading' },
 *   href: '/cases/search',
 *   description: { html: '<strong>Find</strong> and manage case records' },
 *   clickable: false,
 * })
 * ```
 */
export interface MOJCard extends BlockDefinition {
  variant: 'mojCard'

  /**
   * Card heading - can be a simple string or object with additional options.
   * @example 'Search cases'
   * @example { text: 'Search cases', level: 3 }
   */
  heading: ConditionalString | MOJCardHeading

  /** Link URL for the card heading */
  href: ConditionalString

  /**
   * Optional description - can be a simple string or object with additional options.
   * @example 'Find and manage case records'
   * @example { html: '<strong>Find</strong> records' }
   */
  description?: ConditionalString | MOJCardDescription

  /** Makes the entire card clickable via CSS (default: true) */
  clickable?: ConditionalBoolean

  /** Additional CSS classes for the card container */
  classes?: ConditionalString

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

/**
 * Renders an MOJ Card component using Nunjucks template
 */
async function cardRenderer(block: EvaluatedBlock<MOJCard>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params = {
    heading: typeof block.heading === 'object' ? block.heading : { text: block.heading },
    href: block.href,
    description: block.description
      ? typeof block.description === 'object'
        ? block.description
        : { text: block.description }
      : undefined,
    clickable: block.clickable,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('components/card/template.njk', { params })
}

export const mojCard = buildNunjucksComponent<MOJCard>('mojCard', cardRenderer)

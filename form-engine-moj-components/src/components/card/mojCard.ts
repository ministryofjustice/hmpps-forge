import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

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
 * Props for the MOJCard component.
 * @see https://design-patterns.service.justice.gov.uk/components/card/
 *
 * @example
 * ```typescript
 * MOJCard({
 *   heading: 'Search cases',
 *   href: '/cases/search',
 *   description: 'Find and manage case records',
 * })
 * ```
 */
export interface MOJCardProps extends BasicBlockProps {
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
 * MOJ Card Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJCardProps` type or the `MOJCard()` wrapper function instead.
 */
export interface MOJCard extends BlockDefinition, MOJCardProps {
  /** Component variant identifier */
  variant: 'mojCard'
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

/**
 * Creates an MOJ Card block.
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
export function MOJCard(props: MOJCardProps): MOJCard {
  return blockBuilder<MOJCard>({ ...props, variant: 'mojCard' })
}

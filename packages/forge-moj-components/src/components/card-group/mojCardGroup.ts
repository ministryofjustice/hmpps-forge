import type nunjucks from 'nunjucks'

import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { block as buildBlock } from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Heading configuration object for card items.
 */
export interface MOJCardGroupItemHeading {
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
 * Description configuration object for card items.
 */
export interface MOJCardGroupItemDescription {
  /** Description text (required if html not set) */
  text?: string

  /** Description HTML content (required if text not set) */
  html?: string

  /** Additional classes for the description element */
  classes?: string
}

/**
 * Card item configuration for the MOJ Card Group component.
 * Heading and description can be simple strings or objects with additional options.
 */
export interface MOJCardGroupItem {
  /**
   * Card heading - can be a simple string or object with additional options.
   * @example 'Search cases'
   * @example { text: 'Search cases', level: 3 }
   */
  heading: string | MOJCardGroupItemHeading

  /** Link URL for the card heading */
  href: string

  /**
   * Optional description - can be a simple string or object with additional options.
   * @example 'Find and manage case records'
   * @example { html: '<strong>Find</strong> records' }
   */
  description?: string | MOJCardGroupItemDescription

  /** Makes the entire card clickable via CSS (default: true) */
  clickable?: boolean

  /** Additional CSS classes for the card container */
  classes?: string

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

/**
 * Props for the MOJCardGroup component.
 * @see https://design-patterns.service.justice.gov.uk/components/card/
 *
 * @example
 * ```typescript
 * MOJCardGroup({
 *   items: [
 *     { heading: 'Search', href: '/search', description: 'Find records' },
 *     { heading: 'Reports', href: '/reports', description: 'View reports' },
 *   ],
 * })
 * ```
 */
export interface MOJCardGroupProps extends BasicBlockProps {
  /** Array of cards to display */
  items: MOJCardGroupItem[]

  /** Number of columns: 2, 3, or 4 (default: 3) */
  columns?: 2 | 3 | 4

  /** Additional CSS classes for the card group container */
  classes?: ConditionalString

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

/**
 * MOJ Card Group Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `MOJCardGroupProps` type or the `MOJCardGroup()` wrapper function instead.
 */
export interface MOJCardGroup extends BlockDefinition, MOJCardGroupProps {
  /** Component variant identifier */
  variant: 'mojCardGroup'
}

type EvaluatedMOJCardGroupItem = EvaluatedBlock<MOJCardGroup>['items'][number]

/**
 * Normalizes a card item's heading and description to object form
 */
function normalizeCardItem(item: EvaluatedMOJCardGroupItem): {
  heading: MOJCardGroupItemHeading
  href: string
  description: MOJCardGroupItemDescription | undefined
  clickable: boolean | undefined
  classes: string | undefined
  attributes: Record<string, string> | undefined
} {
  const heading = typeof item.heading === 'object' ? normalizeHeading(item.heading) : { text: item.heading }

  return {
    heading,
    href: item.href,
    description: item.description
      ? typeof item.description === 'object'
        ? item.description
        : { text: item.description }
      : undefined,
    clickable: item.clickable,
    classes: item.classes,
    attributes: item.attributes,
  }
}

function normalizeHeading(heading: EvaluatedMOJCardGroupItem['heading']): MOJCardGroupItemHeading {
  if (typeof heading === 'string') {
    return { text: heading }
  }

  return {
    text: heading.text,
    html: heading.html,
    classes: heading.classes,
    level: isHeadingLevel(heading.level) ? heading.level : undefined,
  }
}

function isHeadingLevel(value: number | undefined): value is NonNullable<MOJCardGroupItemHeading['level']> {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
}

/**
 * Renders an MOJ Card Group component using Nunjucks template
 */
function cardGroupRenderer(block: EvaluatedBlock<MOJCardGroup>, nunjucksEnv: nunjucks.Environment): string {
  const params = {
    items: block.items.map(normalizeCardItem),
    columns: block.columns,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('components/card-group/template.njk', { params })
}

export const mojCardGroup = buildNunjucksComponent<MOJCardGroup>('mojCardGroup', cardGroupRenderer)

/**
 * Creates an MOJ Card Group block.
 * A component for displaying multiple cards in a responsive grid layout.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/card/
 * @example
 * ```typescript
 * MOJCardGroup({
 *   items: [
 *     { heading: 'Search', href: '/search', description: 'Find records' },
 *     { heading: 'Reports', href: '/reports', description: 'View reports' },
 *   ],
 *   columns: 2,
 * })
 * ```
 */
export function MOJCardGroup(props: MOJCardGroupProps): MOJCardGroup {
  return buildBlock<MOJCardGroup>({ ...props, variant: 'mojCardGroup' })
}

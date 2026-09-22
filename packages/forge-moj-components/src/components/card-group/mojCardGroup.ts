import {
  BlockDefinition,
  ResolvableArray,
  ResolvableBoolean,
  ResolvableObject,
  ResolvableString,
  EvaluatedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Heading configuration object for card items.
 */
export interface MOJCardGroupItemHeading {
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
 * Description configuration object for card items.
 */
export interface MOJCardGroupItemDescription {
  /** Description text (required if html not set) */
  text?: ResolvableString

  /** Description HTML content (required if text not set) */
  html?: ResolvableString

  /** Additional classes for the description element */
  classes?: ResolvableString
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
  heading: ResolvableString | ResolvableObject<MOJCardGroupItemHeading>

  /** Link URL for the card heading */
  href: ResolvableString

  /**
   * Optional description - can be a simple string or object with additional options.
   * @example 'Find and manage case records'
   * @example { html: '<strong>Find</strong> records' }
   */
  description?: ResolvableString | ResolvableObject<MOJCardGroupItemDescription>

  /** Makes the entire card clickable via CSS (default: true) */
  clickable?: ResolvableBoolean

  /** Additional CSS classes for the card container */
  classes?: ResolvableString

  /** Additional HTML attributes */
  attributes?: Record<string, string>

  /**
   * Conditional visibility for this card. When the evaluated value is `false`,
   * the card is omitted from rendering. Defaults to showing the card.
   */
  visibleWhen?: ResolvableBoolean
}

/**
 * MOJ Card Group component.
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
export interface MOJCardGroup extends BlockDefinition {
  /** Array of cards to display */
  items: ResolvableArray<MOJCardGroupItem>

  /** Number of columns: 2, 3, or 4 (default: 3) */
  columns?: 2 | 3 | 4

  /** Additional CSS classes for the card group container */
  classes?: ResolvableString

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

type EvaluatedMOJCardGroupItem = EvaluatedBlock<MOJCardGroup>['items'][number]

type NormalizedCardItem = {
  heading: EvaluatedBlock<MOJCardGroupItemHeading>
  href: string
  description: EvaluatedBlock<MOJCardGroupItemDescription> | undefined
  clickable: boolean | undefined
  classes: string | undefined
  attributes: Record<string, string> | undefined
}

/**
 * Normalizes a card item's heading and description to object form
 */
function normalizeCardItem(item: EvaluatedMOJCardGroupItem): NormalizedCardItem {
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

function normalizeHeading(heading: EvaluatedMOJCardGroupItem['heading']): EvaluatedBlock<MOJCardGroupItemHeading> {
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
 * MOJ Card Group component.
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
export const MOJCardGroup = nunjucksComponent<MOJCardGroup>('mojCardGroup', {
  render: (props, nunjucksEnv) => {
    const params = {
      items: props.items.filter(item => item.visibleWhen !== false).map(normalizeCardItem),
      columns: props.columns,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('components/card-group/template.njk', { params })
  },
})

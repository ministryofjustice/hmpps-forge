import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  ConditionalArray,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'

/**
 * Heading configuration for a side navigation section.
 */
export interface MOJSideNavigationHeading {
  /** Heading level 1-6 (default: 4) */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6

  /** Heading text (required if html not set) */
  text?: ConditionalString

  /** Heading HTML content (required if text not set) */
  html?: ConditionalString

  /** Additional classes for the heading element */
  classes?: ConditionalString

  /** Additional HTML attributes for the heading */
  attributes?: Record<string, string>
}

/**
 * Navigation item configuration.
 */
export interface MOJSideNavigationItem {
  /** URL of the navigation item anchor */
  href: ConditionalString

  /** Item text (required if html not set) */
  text?: ConditionalString

  /** Item HTML content (required if text not set) */
  html?: ConditionalString

  /** Flag to mark the navigation item as active */
  active?: ConditionalBoolean

  /** Additional HTML attributes for the item */
  attributes?: Record<string, string>
}

/**
 * Section configuration for grouped navigation items.
 */
export interface MOJSideNavigationSection {
  /** Section heading configuration */
  heading?: MOJSideNavigationHeading

  /** Array of navigation items in this section */
  items: ConditionalArray<MOJSideNavigationItem>
}

/**
 * MOJ Side Navigation component for navigation menus.
 *
 * Based on the MOJ Design Patterns side navigation component:
 * https://design-patterns.service.justice.gov.uk/components/side-navigation
 *
 * The side navigation component provides a vertical navigation menu.
 * It can be used in simple mode with just items, or in sectioned mode
 * with grouped items under headings.
 *
 * @example
 * ```typescript
 * // Simple form - flat list of items
 * block<MOJSideNavigation>({
 *   variant: 'mojSideNavigation',
 *   label: 'Side navigation',
 *   items: [
 *     { text: 'Nav item 1', href: '#1', active: true },
 *     { text: 'Nav item 2', href: '#2' },
 *     { text: 'Nav item 3', href: '#3' },
 *   ],
 * })
 *
 * // Sectioned form - items grouped under headings
 * block<MOJSideNavigation>({
 *   variant: 'mojSideNavigation',
 *   label: 'Side navigation',
 *   sections: [
 *     {
 *       heading: { text: 'Section 1' },
 *       items: [
 *         { text: 'Item 1.1', href: '#1-1', active: true },
 *         { text: 'Item 1.2', href: '#1-2' },
 *       ],
 *     },
 *     {
 *       heading: { text: 'Section 2', headingLevel: 3 },
 *       items: [
 *         { text: 'Item 2.1', href: '#2-1' },
 *       ],
 *     },
 *   ],
 * })
 * ```
 */
export interface MOJSideNavigation extends BlockDefinition {
  variant: 'mojSideNavigation'

  /** The aria-label to add to the navigation container */
  label?: ConditionalString

  /** Array of navigation items (simple mode - use instead of sections) */
  items?: ConditionalArray<MOJSideNavigationItem>

  /** Array of navigation sections (sectioned mode - use instead of items) */
  sections?: ConditionalArray<MOJSideNavigationSection>

  /** Additional CSS classes for the nav container */
  classes?: ConditionalString

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

/**
 * Renders an MOJ Side Navigation component using Nunjucks template
 */
async function sideNavigationRenderer(
  block: EvaluatedBlock<MOJSideNavigation>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    label: block.label,
    items: block.items,
    sections: block.sections,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/side-navigation/template.njk', { params })
}

export const mojSideNavigation = buildNunjucksComponent<MOJSideNavigation>('mojSideNavigation', sideNavigationRenderer)

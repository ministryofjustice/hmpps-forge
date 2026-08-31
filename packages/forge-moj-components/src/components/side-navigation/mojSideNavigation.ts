import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Heading configuration for a side navigation section.
 */
export interface MOJSideNavigationHeading {
  /** Heading level 1-6 (default: 4) */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6

  /** Heading text (required if html not set) */
  text?: string

  /** Heading HTML content (required if text not set) */
  html?: string

  /** Additional classes for the heading element */
  classes?: string

  /** Additional HTML attributes for the heading */
  attributes?: Record<string, string>
}

/**
 * Navigation item configuration.
 */
export interface MOJSideNavigationItem {
  /** URL of the navigation item anchor */
  href: string

  /** Item text (required if html not set) */
  text?: string

  /** Item HTML content (required if text not set) */
  html?: string

  /** Flag to mark the navigation item as active */
  active?: boolean

  /** Conditional visibility for this navigation item */
  visibleWhen?: boolean

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
  items: MOJSideNavigationItem[]

  /** Conditional visibility for this navigation section */
  visibleWhen?: boolean
}

/**
 * MOJ Side Navigation component.
 * A vertical navigation menu component following the MOJ Design Patterns.
 *
 * It can be used in simple mode with just items, or in sectioned mode
 * with grouped items under headings.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/side-navigation
 * @example
 * ```typescript
 * // Simple form - flat list of items
 * MOJSideNavigation({
 *   label: 'Side navigation',
 *   items: [
 *     { text: 'Nav item 1', href: '#1', active: true },
 *     { text: 'Nav item 2', href: '#2' },
 *     { text: 'Nav item 3', href: '#3' },
 *   ],
 * })
 *
 * // Sectioned form - items grouped under headings
 * MOJSideNavigation({
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
export interface MOJSideNavigation {
  /**
   * The aria-label to add to the navigation container.
   * @example 'Side navigation'
   */
  label?: string

  /**
   * Array of navigation items (simple mode - use instead of sections).
   * @example [{ text: 'Nav item 1', href: '#1', active: true }]
   */
  items?: MOJSideNavigationItem[]

  /**
   * Array of navigation sections (sectioned mode - use instead of items).
   * @example [{ heading: { text: 'Section 1' }, items: [...] }]
   */
  sections?: MOJSideNavigationSection[]

  /**
   * Additional CSS classes for the nav container.
   * @example 'app-side-navigation--custom'
   */
  classes?: string

  /**
   * Additional HTML attributes for the navigation container.
   * @example { 'data-module': 'app-navigation' }
   */
  attributes?: Record<string, string>
}

/**
 * MOJ Side Navigation component.
 * A vertical navigation menu component following the MOJ Design Patterns.
 *
 * It can be used in simple mode with just items, or in sectioned mode
 * with grouped items under headings.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/side-navigation
 * @example
 * ```typescript
 * // Simple form - flat list of items
 * MOJSideNavigation({
 *   label: 'Side navigation',
 *   items: [
 *     { text: 'Nav item 1', href: '#1', active: true },
 *     { text: 'Nav item 2', href: '#2' },
 *     { text: 'Nav item 3', href: '#3' },
 *   ],
 * })
 *
 * // Sectioned form - items grouped under headings
 * MOJSideNavigation({
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
export const MOJSideNavigation = nunjucksComponent<MOJSideNavigation>('mojSideNavigation', {
  factory:
    ({ nunjucksEnv }) =>
    props => {
      const items = props.items?.filter(item => item.visibleWhen !== false)
      const sections = props.sections
        ?.filter(section => section.visibleWhen !== false)
        .map(section => ({
          ...section,
          items: section.items.filter(item => item.visibleWhen !== false),
        }))

      const params = {
        label: props.label,
        items,
        sections,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('moj/components/side-navigation/template.njk', { params })
    },
})

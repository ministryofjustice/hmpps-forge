import {
  BlockDefinition,
  ResolvableString,
  ResolvableBoolean,
  ResolvableArray,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Navigation item configuration.
 */
export interface MOJSubNavigationItem {
  /** URL of the navigation item anchor */
  href: ResolvableString

  /** Item text (required if html not set) */
  text?: ResolvableString

  /** Item HTML content (required if text not set) */
  html?: ResolvableString

  /** Flag to mark the navigation item as active (aria-current="page") */
  active?: ResolvableBoolean

  /** Conditional visibility for this navigation item */
  visibleWhen?: ResolvableBoolean

  /** Additional HTML attributes for the item */
  attributes?: Record<string, string>
}

/**
 * MOJ Sub-Navigation component.
 * Enables users to navigate secondary sections within a system or service.
 *
 * Use this component for secondary-level navigation, not for primary or global
 * navigation elements.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/sub-navigation/
 * @example
 * ```typescript
 * MOJSubNavigation({
 *   label: 'Case sections',
 *   items: [
 *     { text: 'Overview', href: '/case/123/overview', active: true },
 *     { text: 'Documents', href: '/case/123/documents' },
 *     { text: 'Timeline', href: '/case/123/timeline' },
 *   ],
 * })
 * ```
 */
export interface MOJSubNavigation extends BlockDefinition {
  /** The aria-label to add to the navigation container (defaults to "Secondary navigation region") */
  label?: ResolvableString

  /** Array of navigation items */
  items: ResolvableArray<MOJSubNavigationItem>

  /** Additional CSS classes for the nav container */
  classes?: ResolvableString

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

/**
 * MOJ Sub-Navigation component.
 * Enables users to navigate secondary sections within a system or service.
 *
 * Use this component for secondary-level navigation, not for primary or global
 * navigation elements.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/sub-navigation/
 * @example
 * ```typescript
 * MOJSubNavigation({
 *   label: 'Case sections',
 *   items: [
 *     { text: 'Overview', href: '/case/123/overview', active: true },
 *     { text: 'Documents', href: '/case/123/documents' },
 *     { text: 'Timeline', href: '/case/123/timeline' },
 *   ],
 * })
 * ```
 */
export const MOJSubNavigation = nunjucksComponent<MOJSubNavigation>('mojSubNavigation', {
  render: (props, nunjucksEnv) => {
    const params = {
      label: props.label,
      items: props.items.filter(item => item.visibleWhen !== false),
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/sub-navigation/template.njk', { params })
  },
})

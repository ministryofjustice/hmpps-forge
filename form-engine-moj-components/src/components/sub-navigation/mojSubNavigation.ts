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
 * Navigation item configuration.
 */
export interface MOJSubNavigationItem {
  /** URL of the navigation item anchor */
  href: ConditionalString

  /** Item text (required if html not set) */
  text?: ConditionalString

  /** Item HTML content (required if text not set) */
  html?: ConditionalString

  /** Flag to mark the navigation item as active (aria-current="page") */
  active?: ConditionalBoolean

  /** Additional HTML attributes for the item */
  attributes?: Record<string, string>
}

/**
 * MOJ Sub-Navigation component for secondary-level navigation.
 *
 * Based on the MOJ Design Patterns sub-navigation component:
 * https://design-patterns.service.justice.gov.uk/components/sub-navigation/
 *
 * The sub-navigation component enables users to navigate secondary sections
 * within a system or service. Use this component for secondary-level navigation,
 * not for primary or global navigation elements.
 *
 * @example
 * ```typescript
 * block<MOJSubNavigation>({
 *   variant: 'mojSubNavigation',
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
  variant: 'mojSubNavigation'

  /** The aria-label to add to the navigation container (defaults to "Secondary navigation region") */
  label?: ConditionalString

  /** Array of navigation items */
  items: ConditionalArray<MOJSubNavigationItem>

  /** Additional CSS classes for the nav container */
  classes?: ConditionalString

  /** Additional HTML attributes */
  attributes?: Record<string, string>
}

/**
 * Renders an MOJ Sub-Navigation component using Nunjucks template
 */
async function subNavigationRenderer(
  block: EvaluatedBlock<MOJSubNavigation>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    label: block.label,
    items: block.items,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/sub-navigation/template.njk', { params })
}

export const mojSubNavigation = buildNunjucksComponent<MOJSubNavigation>('mojSubNavigation', subNavigationRenderer)

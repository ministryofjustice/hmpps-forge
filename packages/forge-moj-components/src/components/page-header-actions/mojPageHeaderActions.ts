import {
  BlockDefinition,
  ResolvableString,
  ResolvableArray,
  ResolvableObject,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import type { MOJButtonMenuItem } from '../button-menu/mojButtonMenu'

/** Page heading displayed beside the actions. */
export interface MOJPageHeaderActionsHeading {
  text?: ResolvableString
  html?: ResolvableString
  level?: 1 | 2 | 3 | 4 | 5 | 6
  classes?: ResolvableString
}

/**
 * Displays a page heading alongside action buttons.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/page-header-actions/
 */
export interface MOJPageHeaderActions extends BlockDefinition {
  heading: ResolvableString | ResolvableObject<MOJPageHeaderActionsHeading>
  items?: ResolvableArray<MOJButtonMenuItem>

  /** Additional CSS classes. */
  classes?: ResolvableString

  /** Additional HTML attributes. */
  attributes?: Record<string, ResolvableString>
}

/**
 * Displays a page heading alongside action buttons.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/page-header-actions/
 */
export const MOJPageHeaderActions = nunjucksComponent<MOJPageHeaderActions>('mojPageHeaderActions', {
  render: (props, nunjucksEnv) => {
    const params = {
      heading: typeof props.heading === 'string' ? { text: props.heading } : props.heading,
      items: props.items?.filter(item => item.visibleWhen !== false),
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/page-header-actions/template.njk', { params })
  },
})

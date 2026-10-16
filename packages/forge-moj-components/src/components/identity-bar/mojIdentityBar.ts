import {
  BlockDefinition,
  ResolvableString,
  ResolvableBoolean,
  ResolvableArray,
  ResolvableObject,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import type { MOJButtonMenuButton, MOJButtonMenuItem } from '../button-menu/mojButtonMenu'

/** Title identifying the current person or case. */
export interface MOJIdentityBarTitle {
  text?: ResolvableString
  html?: ResolvableString
}

/** Action menu displayed alongside the identity. */
export interface MOJIdentityBarMenu {
  button?: ResolvableObject<MOJButtonMenuButton>
  alignMenu?: ResolvableString
  items: ResolvableArray<MOJButtonMenuItem>
  classes?: ResolvableString
  attributes?: Record<string, ResolvableString>
  visibleWhen?: ResolvableBoolean
}

/**
 * Shows the identity of the current case or person with related action menus.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/identity-bar/
 */
export interface MOJIdentityBar extends BlockDefinition {
  title?: ResolvableString | ResolvableObject<MOJIdentityBarTitle>
  menus?: ResolvableArray<MOJIdentityBarMenu>

  /** Additional CSS classes. */
  classes?: ResolvableString

  /** Additional HTML attributes. */
  attributes?: Record<string, ResolvableString>
}

/**
 * Shows the identity of the current case or person with related action menus.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/identity-bar/
 */
export const MOJIdentityBar = nunjucksComponent<MOJIdentityBar>('mojIdentityBar', {
  render: (props, nunjucksEnv) => {
    const params = {
      title: typeof props.title === 'string' ? { text: props.title } : props.title,
      menus: props.menus
        ?.filter(menu => menu.visibleWhen !== false)
        .map(menu => ({
          ...menu,
          items: menu.items.filter(item => item.visibleWhen !== false),
        })),
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/identity-bar/template.njk', { params })
  },
})

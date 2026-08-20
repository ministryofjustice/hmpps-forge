import {
  BlockDefinition,
  ResolvableString,
  ResolvableBoolean,
  ResolvableArray,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Menu alignment options for the button menu dropdown.
 */
export type MOJButtonMenuAlign = 'left' | 'right'

/**
 * Configuration for the toggle button that opens/closes the menu.
 */
export interface MOJButtonMenuButton {
  /**
   * Text content for the toggle button.
   *
   * @example 'Actions'
   * @example 'Options'
   */
  text?: ResolvableString

  /**
   * Additional CSS classes for the toggle button.
   *
   * @example 'govuk-button--secondary'
   */
  classes?: ResolvableString
}

/**
 * Menu item configuration for a button in the menu.
 * Based on GOV.UK Button component parameters.
 *
 * @see https://design-system.service.gov.uk/components/button/
 */
export interface MOJButtonMenuItem {
  /**
   * Whether to use an `input`, `button` or `a` element.
   * Automatically configured if `href` or `html` is set.
   *
   * @example 'button'
   * @example 'a'
   */
  element?: 'input' | 'button' | 'a' | ResolvableString

  /**
   * Text content for the button or link.
   * Required if `html` is not set.
   *
   * @example 'Archive'
   * @example 'Delete'
   */
  text?: ResolvableString

  /**
   * HTML content for the button or link.
   * Required if `text` is not set.
   *
   * @example '<span class="icon">+</span> Add item'
   */
  html?: ResolvableString

  /**
   * Name attribute for input or button elements.
   * Has no effect on anchor elements.
   *
   * @example 'action'
   */
  name?: ResolvableString

  /**
   * Type attribute for input or button elements.
   * Options: 'button', 'submit', 'reset'. Default: 'submit'.
   * Has no effect on anchor elements.
   *
   * @example 'button'
   */
  type?: 'button' | 'submit' | 'reset' | ResolvableString

  /**
   * Value attribute for button elements.
   * Has no effect on anchor or input elements.
   *
   * @example 'archive'
   */
  value?: ResolvableString

  /**
   * Whether the button should be disabled.
   *
   * @example true
   */
  disabled?: ResolvableBoolean

  /**
   * URL that the button should link to.
   * If set, `element` defaults to 'a'.
   *
   * @example '/actions/archive'
   * @example '#archive'
   */
  href?: ResolvableString

  /**
   * Additional CSS classes for the button.
   *
   * @example 'govuk-button--warning'
   */
  classes?: ResolvableString

  /**
   * Additional HTML attributes for the button.
   *
   * @example { 'data-action': 'archive' }
   */
  attributes?: Record<string, ResolvableString>

  /**
   * Prevent accidental double clicks from submitting forms multiple times.
   *
   * @example true
   */
  preventDoubleClick?: ResolvableBoolean

  /**
   * Conditional visibility for this menu item.
   * When the evaluated value is `false`, the item is omitted from rendering.
   */
  visibleWhen?: ResolvableBoolean
}

/**
 * MOJ Button Menu component.
 * A dropdown button that reveals a menu of actions.
 *
 * The button menu component is useful for grouping secondary actions together
 * to reduce visual clutter while keeping them easily accessible.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/button-menu
 * @example
 * ```typescript
 * MOJButtonMenu({
 *   button: {
 *     text: 'Actions',
 *     classes: 'govuk-button--secondary',
 *   },
 *   alignMenu: 'right',
 *   items: [
 *     { text: 'Archive', href: '#archive' },
 *     { text: 'Reassign', href: '#reassign' },
 *     { text: 'Delete', href: '#delete', classes: 'govuk-button--warning' },
 *   ],
 * })
 * ```
 */
export interface MOJButtonMenu extends BlockDefinition {
  /**
   * Configuration for the toggle button.
   * Sets the text and styling of the button that opens the menu.
   *
   * @example { text: 'Actions', classes: 'govuk-button--secondary' }
   */
  button?: MOJButtonMenuButton

  /**
   * Alignment of the dropdown menu relative to the toggle button.
   * Options: 'left' (default), 'right'
   *
   * @example 'right'
   */
  alignMenu?: MOJButtonMenuAlign | ResolvableString

  /**
   * Array of menu item button configurations.
   * Each item becomes a button/link in the dropdown menu.
   *
   * @example [{ text: 'Archive', href: '#archive' }]
   */
  items: ResolvableArray<MOJButtonMenuItem>

  /**
   * Additional CSS classes for the menu container.
   *
   * @example 'app-button-menu--custom'
   */
  classes?: ResolvableString

  /**
   * Additional HTML attributes for the menu container.
   *
   * @example { 'data-module': 'custom-menu' }
   */
  attributes?: Record<string, ResolvableString>
}

/**
 * MOJ Button Menu component.
 * A dropdown button that reveals a menu of actions.
 *
 * The button menu component is useful for grouping secondary actions together
 * to reduce visual clutter while keeping them easily accessible.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/button-menu
 * @example
 * ```typescript
 * MOJButtonMenu({
 *   button: {
 *     text: 'Actions',
 *     classes: 'govuk-button--secondary',
 *   },
 *   alignMenu: 'right',
 *   items: [
 *     { text: 'Archive', href: '#archive' },
 *     { text: 'Reassign', href: '#reassign' },
 *     { text: 'Delete', href: '#delete', classes: 'govuk-button--warning' },
 *   ],
 * })
 * ```
 */
export const MOJButtonMenu = nunjucksComponent<MOJButtonMenu>('mojButtonMenu', {
  render: (props, nunjucksEnv) => {
    const params = {
      button: props.button,
      alignMenu: props.alignMenu,
      items: props.items.filter(item => item.visibleWhen !== false),
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/button-menu/template.njk', { params })
  },
})

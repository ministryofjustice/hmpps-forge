import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  ConditionalArray,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

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
  text?: ConditionalString

  /**
   * Additional CSS classes for the toggle button.
   *
   * @example 'govuk-button--secondary'
   */
  classes?: ConditionalString
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
  element?: 'input' | 'button' | 'a' | ConditionalString

  /**
   * Text content for the button or link.
   * Required if `html` is not set.
   *
   * @example 'Archive'
   * @example 'Delete'
   */
  text?: ConditionalString

  /**
   * HTML content for the button or link.
   * Required if `text` is not set.
   *
   * @example '<span class="icon">+</span> Add item'
   */
  html?: ConditionalString

  /**
   * Name attribute for input or button elements.
   * Has no effect on anchor elements.
   *
   * @example 'action'
   */
  name?: ConditionalString

  /**
   * Type attribute for input or button elements.
   * Options: 'button', 'submit', 'reset'. Default: 'submit'.
   * Has no effect on anchor elements.
   *
   * @example 'button'
   */
  type?: 'button' | 'submit' | 'reset' | ConditionalString

  /**
   * Value attribute for button elements.
   * Has no effect on anchor or input elements.
   *
   * @example 'archive'
   */
  value?: ConditionalString

  /**
   * Whether the button should be disabled.
   *
   * @example true
   */
  disabled?: ConditionalBoolean

  /**
   * URL that the button should link to.
   * If set, `element` defaults to 'a'.
   *
   * @example '/actions/archive'
   * @example '#archive'
   */
  href?: ConditionalString

  /**
   * Additional CSS classes for the button.
   *
   * @example 'govuk-button--warning'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the button.
   *
   * @example { 'data-action': 'archive' }
   */
  attributes?: Record<string, ConditionalString>

  /**
   * Prevent accidental double clicks from submitting forms multiple times.
   *
   * @example true
   */
  preventDoubleClick?: ConditionalBoolean
}

/**
 * Props for the MOJButtonMenu component.
 *
 * The button menu component displays a dropdown button that reveals a menu
 * of actions. It's useful for grouping secondary actions to reduce clutter.
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
export interface MOJButtonMenuProps extends BasicBlockProps {
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
  alignMenu?: MOJButtonMenuAlign | ConditionalString

  /**
   * Array of menu item button configurations.
   * Each item becomes a button/link in the dropdown menu.
   *
   * @example [{ text: 'Archive', href: '#archive' }]
   */
  items: ConditionalArray<MOJButtonMenuItem>

  /**
   * Additional CSS classes for the menu container.
   *
   * @example 'app-button-menu--custom'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the menu container.
   *
   * @example { 'data-module': 'custom-menu' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Button Menu Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJButtonMenuProps` type or the `MOJButtonMenu()` wrapper function instead.
 */
export interface MOJButtonMenu extends BlockDefinition, MOJButtonMenuProps {
  /** Component variant identifier */
  variant: 'mojButtonMenu'
}

/**
 * Renders an MOJ Button Menu component using Nunjucks template
 */
async function buttonMenuRenderer(
  block: EvaluatedBlock<MOJButtonMenu>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    button: block.button,
    alignMenu: block.alignMenu,
    items: block.items,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/button-menu/template.njk', { params })
}

export const mojButtonMenu = buildNunjucksComponent<MOJButtonMenu>('mojButtonMenu', buttonMenuRenderer)

/**
 * Creates an MOJ Button Menu block for displaying a dropdown menu of actions.
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
export function MOJButtonMenu(props: MOJButtonMenuProps): MOJButtonMenu {
  return blockBuilder<MOJButtonMenu>({ ...props, variant: 'mojButtonMenu' })
}

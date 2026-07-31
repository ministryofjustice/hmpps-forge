import type nunjucks from 'nunjucks'
import {
  BlockDefinition,
  ResolvableBoolean,
  ResolvableString,
  ResolvedPropsOf,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

/**
 * GOV.UK Button component.
 *
 * Creates a button for form submission. Renders as a `<button>` element with form
 * submission capabilities.
 *
 * @see https://design-system.service.gov.uk/components/button/
 * @example
 * ```typescript
 * GovUKButton({
 *   text: 'Save and continue',
 *   buttonType: 'submit',
 *   name: 'action',
 *   value: 'save',
 * })
 * ```
 */
export interface GovUKButton extends BlockDefinition {
  /** Text content for the button */
  text?: ResolvableString

  /** HTML content for the button */
  html?: ResolvableString

  /** Additional CSS classes */
  classes?: ResolvableString

  /** Custom HTML attributes */
  attributes?: Record<string, any>

  /** Style as start/call-to-action button */
  isStartButton?: ResolvableBoolean

  /** Button ID */
  id?: ResolvableString

  /** Name attribute for form submission, defaults to 'action' */
  name?: ResolvableString

  /** Type attribute for button/input elements - defaults to 'submit' */
  buttonType?: 'button' | 'submit' | 'reset'

  /** Value attribute for button elements */
  value?: ResolvableString

  /** Whether the button is disabled */
  disabled?: ResolvableBoolean

  /** Prevent double-click submission */
  preventDoubleClick?: ResolvableBoolean
}

/**
 * GOV.UK Link Button component.
 *
 * Creates a button for navigation. Renders as an `<a>` element styled as a button.
 *
 * @see https://design-system.service.gov.uk/components/button/
 * @example
 * ```typescript
 * GovUKLinkButton({
 *   text: 'Start now',
 *   href: '/application/start',
 *   isStartButton: true,
 * })
 * ```
 */
export interface GovUKLinkButton extends BlockDefinition {
  /** Text content for the button */
  text?: ResolvableString

  /** HTML content for the button */
  html?: ResolvableString

  /** Additional CSS classes */
  classes?: ResolvableString

  /** Custom HTML attributes */
  attributes?: Record<string, any>

  /** Style as start/call-to-action button */
  isStartButton?: ResolvableBoolean

  /** Button ID */
  id?: ResolvableString

  /** URL for the link */
  href: ResolvableString
}

function isLinkButton(
  props: ResolvedPropsOf<GovUKButton> | ResolvedPropsOf<GovUKLinkButton>,
): props is ResolvedPropsOf<GovUKLinkButton> {
  return 'href' in props && props.href !== undefined
}

/**
 * Shared renderer function for both button types.
 * Determines the appropriate element type and parameters based on the variant.
 */
function buttonRenderer(
  props: ResolvedPropsOf<GovUKButton> | ResolvedPropsOf<GovUKLinkButton>,
  nunjucksEnv: nunjucks.Environment,
): string {
  let params: Record<string, any> = {
    id: props.id,
    text: props.html ? undefined : props.text,
    html: props.html,
    classes: props.classes,
    attributes: props.attributes,
    isStartButton: props.isStartButton,
  }

  if (isLinkButton(props)) {
    params = {
      ...params,
      href: props.href,
    }
  } else {
    params = {
      ...params,
      name: props.name ?? 'action',
      type: props.buttonType || 'submit',
      value: props.value,
      disabled: props.disabled,
      preventDoubleClick: props.preventDoubleClick,
    }
  }

  return nunjucksEnv.render('govuk/components/button/template.njk', { params })
}

/**
 * GOV.UK Button component.
 *
 * Creates a button for form submission. Renders as a `<button>` element with form
 * submission capabilities.
 *
 * @see https://design-system.service.gov.uk/components/button/
 * @example
 * ```typescript
 * GovUKButton({
 *   text: 'Save and continue',
 *   buttonType: 'submit',
 *   name: 'action',
 *   value: 'save',
 * })
 * ```
 */
export const GovUKButton = nunjucksComponent<GovUKButton>('govukButton', {
  render: buttonRenderer,
})

/**
 * GOV.UK Link Button component.
 *
 * Creates a button for navigation. Renders as an `<a>` element styled as a button.
 *
 * @see https://design-system.service.gov.uk/components/button/
 * @example
 * ```typescript
 * GovUKLinkButton({
 *   text: 'Start now',
 *   href: '/application/start',
 *   isStartButton: true,
 * })
 * ```
 */
export const GovUKLinkButton = nunjucksComponent<GovUKLinkButton>('govukLinkButton', {
  render: buttonRenderer,
})

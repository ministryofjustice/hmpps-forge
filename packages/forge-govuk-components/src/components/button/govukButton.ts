import type nunjucks from 'nunjucks'
import {
  BasicBlockProps,
  BlockDefinition,
  ResolvableBoolean,
  ResolvableString,
  EvaluatedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { block as buildBlock } from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Props for the GovUKButton component.
 * Contains properties common to standard buttons.
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
export interface GovUKButtonProps extends BasicBlockProps {
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
 * Props for the GovUKLinkButton component.
 * Contains properties for link-styled buttons.
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
export interface GovUKLinkButtonProps extends BasicBlockProps {
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

/**
 * GOV.UK Button Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKButtonProps` type or the `GovUKButton()` wrapper function instead.
 */
export interface GovUKButton extends BlockDefinition, GovUKButtonProps {
  /** Component variant identifier */
  variant: 'govukButton'
}

/**
 * GOV.UK Link Button Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKLinkButtonProps` type or the `GovUKLinkButton()` wrapper function instead.
 */
export interface GovUKLinkButton extends BlockDefinition, GovUKLinkButtonProps {
  /** Component variant identifier */
  variant: 'govukLinkButton'
}

/**
 * Shared renderer function for both button types.
 * Determines the appropriate element type and parameters based on the variant.
 */
function buttonRenderer(block: EvaluatedBlock<GovUKButton | GovUKLinkButton>, nunjucksEnv: nunjucks.Environment) {
  let params: Record<string, any> = {
    id: block.id,
    text: block.html ? undefined : block.text,
    html: block.html,
    classes: block.classes,
    attributes: block.attributes,
    isStartButton: block.isStartButton,
  }

  if (isLinkButton(block)) {
    params = {
      ...params,
      href: block.href,
    }
  } else {
    const buttonBlock = block as EvaluatedBlock<GovUKButton>
    params = {
      ...params,
      name: buttonBlock.name ?? 'action',
      type: buttonBlock.buttonType || 'submit',
      value: buttonBlock.value,
      disabled: buttonBlock.disabled,
      preventDoubleClick: buttonBlock.preventDoubleClick,
    }
  }

  return nunjucksEnv.render('govuk/components/button/template.njk', { params })
}

export const govukButton = buildNunjucksComponent<GovUKButton>('govukButton', buttonRenderer)

export const govukLinkButton = buildNunjucksComponent<GovUKLinkButton>('govukLinkButton', buttonRenderer)

function isLinkButton(block: EvaluatedBlock<GovUKButton | GovUKLinkButton>): block is EvaluatedBlock<GovUKLinkButton> {
  return 'href' in block && block.href !== undefined
}

/**
 * Creates a GOV.UK Button for form submission.
 * Renders as a `<button>` element with form submission capabilities.
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
export function GovUKButton(props: GovUKButtonProps): GovUKButton {
  return buildBlock<GovUKButton>({ ...props, variant: 'govukButton' })
}

/**
 * Creates a GOV.UK Link Button for navigation.
 * Renders as an `<a>` element styled as a button.
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
export function GovUKLinkButton(props: GovUKLinkButtonProps): GovUKLinkButton {
  return buildBlock<GovUKLinkButton>({ ...props, variant: 'govukLinkButton' })
}

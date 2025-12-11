import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BlockDefinition,
  ConditionalBoolean,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'

/**
 * Base interface for GOV.UK Button components.
 * Contains properties common to both standard buttons and link buttons.
 */
interface GovUKButtonBase extends BlockDefinition {
  /** Text content for the button */
  text?: ConditionalString

  /** HTML content for the button */
  html?: ConditionalString

  /** Additional CSS classes */
  classes?: ConditionalString

  /** Custom HTML attributes */
  attributes?: Record<string, any>

  /** Style as start/call-to-action button */
  isStartButton?: ConditionalBoolean

  /** Button ID */
  id?: ConditionalString
}

/**
 * GOV.UK Button component for standard button elements.
 * Renders as a `<button>` or `<input>` element with form submission capabilities.
 *
 * @example
 * ```typescript
 * {
 *   variant: 'govukButton',
 *   text: 'Save and continue',
 *   buttonType: 'submit',
 *   name: 'action',
 *   value: 'save'
 * }
 * ```
 */
export interface GovUKButton extends GovUKButtonBase {
  variant: 'govukButton'

  /** Name attribute for form submission, defaults to 'action' */
  name?: ConditionalString

  /** Type attribute for button/input elements - defaults to 'submit' */
  buttonType?: 'button' | 'submit' | 'reset'

  /** Value attribute for button elements */
  value?: ConditionalString

  /** Whether the button is disabled */
  disabled?: ConditionalBoolean

  /** Prevent double-click submission */
  preventDoubleClick?: ConditionalBoolean
}

/**
 * GOV.UK Link Button component for link elements styled as buttons.
 * Renders as an `<a>` element with button styling for navigation.
 *
 * @example
 * ```typescript
 * {
 *   variant: 'govukLinkButton',
 *   text: 'Continue to next step',
 *   href: '/next-step',
 *   isStartButton: true
 * }
 * ```
 */
export interface GovUKLinkButton extends GovUKButtonBase {
  variant: 'govukLinkButton'

  /** URL for the link */
  href: ConditionalString
}

/**
 * Shared renderer function for both button types.
 * Determines the appropriate element type and parameters based on the variant.
 */
async function buttonRenderer(block: EvaluatedBlock<GovUKButton | GovUKLinkButton>, nunjucksEnv: nunjucks.Environment) {
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
      element: 'a',
      href: block.href,
    }
  } else {
    const buttonBlock = block as EvaluatedBlock<GovUKButton>
    params = {
      ...params,
      element: 'button',
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

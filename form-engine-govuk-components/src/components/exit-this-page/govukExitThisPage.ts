import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Props for the GovUKExitThisPage component.
 *
 * This is a safety feature that provides users with a quick way to leave a page.
 * It should be used on pages with sensitive information where users may need
 * to hide what they're viewing quickly.
 *
 * @see https://design-system.service.gov.uk/components/exit-this-page/
 * @example
 * ```typescript
 * GovUKExitThisPage({
 *   redirectUrl: 'https://www.google.co.uk',
 * })
 * ```
 */
export interface GovUKExitThisPageProps extends BasicBlockProps {
  /**
   * Plain text content for the button.
   * If `html` is provided, this option will be ignored.
   * Defaults to "Emergency Exit this page" with 'Emergency' visually hidden.
   */
  text?: ConditionalString

  /**
   * HTML content for the button.
   * Takes precedence over `text` if both are provided.
   * Defaults to "Emergency Exit this page" with 'Emergency' visually hidden.
   */
  html?: ConditionalString

  /**
   * URL to redirect the current tab to when the exit button is activated.
   * Defaults to "https://www.bbc.co.uk/weather".
   */
  redirectUrl?: ConditionalString

  /**
   * ID attribute to add to the exit this page container.
   */
  id?: ConditionalString

  /**
   * Additional CSS classes to add to the exit this page container.
   */
  classes?: ConditionalString

  /**
   * HTML attributes (for example data attributes) to add to the exit this page container.
   */
  attributes?: Record<string, any>

  /**
   * Text announced by screen readers when Exit this Page has been activated
   * via the keyboard shortcut.
   * Defaults to "Loading.".
   */
  activatedText?: ConditionalString

  /**
   * Text announced by screen readers when the keyboard shortcut has timed out
   * without successful activation.
   * Defaults to "Exit this page expired.".
   */
  timedOutText?: ConditionalString

  /**
   * Text announced by screen readers when the user must press Shift two more
   * times to activate the button.
   * Defaults to "Shift, press 2 more times to exit.".
   */
  pressTwoMoreTimesText?: ConditionalString

  /**
   * Text announced by screen readers when the user must press Shift one more
   * time to activate the button.
   * Defaults to "Shift, press 1 more time to exit.".
   */
  pressOneMoreTimeText?: ConditionalString
}

/**
 * GOV.UK Exit This Page component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKExitThisPageProps` type or the `GovUKExitThisPage()` wrapper function instead.
 */
export interface GovUKExitThisPage extends BlockDefinition, GovUKExitThisPageProps {
  /** Component variant identifier */
  variant: 'govukExitThisPage'
}

/**
 * Renders the GOV.UK Exit This Page component using the official Nunjucks template.
 */
async function exitThisPageRenderer(
  block: EvaluatedBlock<GovUKExitThisPage>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    id: block.id,
    text: block.html ? undefined : block.text,
    html: block.html,
    redirectUrl: block.redirectUrl,
    classes: block.classes,
    attributes: block.attributes,
    activatedText: block.activatedText,
    timedOutText: block.timedOutText,
    pressTwoMoreTimesText: block.pressTwoMoreTimesText,
    pressOneMoreTimeText: block.pressOneMoreTimeText,
  }

  return nunjucksEnv.render('govuk/components/exit-this-page/template.njk', { params })
}

export const govukExitThisPage = buildNunjucksComponent<GovUKExitThisPage>('govukExitThisPage', exitThisPageRenderer)

/**
 * Creates a GOV.UK Exit This Page block for providing a quick escape route.
 * This is a safety feature for pages with sensitive content where users may need
 * to hide what they're viewing quickly.
 *
 * Users can activate the exit by clicking the button or pressing Shift 3 times.
 *
 * @see https://design-system.service.gov.uk/components/exit-this-page/
 * @example
 * ```typescript
 * // Basic usage with default redirect
 * GovUKExitThisPage({})
 *
 * // With custom redirect URL
 * GovUKExitThisPage({
 *   redirectUrl: 'https://www.google.co.uk',
 * })
 *
 * // With custom button text
 * GovUKExitThisPage({
 *   text: 'Leave this page',
 *   redirectUrl: 'https://www.google.co.uk',
 * })
 * ```
 */
export function GovUKExitThisPage(props: GovUKExitThisPageProps): GovUKExitThisPage {
  return blockBuilder<GovUKExitThisPage>({ ...props, variant: 'govukExitThisPage' })
}

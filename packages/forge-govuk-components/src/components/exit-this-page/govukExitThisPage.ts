import { ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * GOV.UK Exit This Page component.
 *
 * A safety feature providing a quick escape route. Use it on pages with sensitive
 * information where users may need to hide what they're viewing quickly.
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
export type GovUKExitThisPage = ResolvableBlockProps<{
  /**
   * Plain text content for the button.
   * If `html` is provided, this option will be ignored.
   * Defaults to "Emergency Exit this page" with 'Emergency' visually hidden.
   */
  text?: string

  /**
   * HTML content for the button.
   * Takes precedence over `text` if both are provided.
   * Defaults to "Emergency Exit this page" with 'Emergency' visually hidden.
   */
  html?: string

  /**
   * URL to redirect the current tab to when the exit button is activated.
   * Defaults to "https://www.bbc.co.uk/weather".
   */
  redirectUrl?: string

  /**
   * ID attribute to add to the exit this page container.
   */
  id?: string

  /**
   * Additional CSS classes to add to the exit this page container.
   */
  classes?: string

  /**
   * HTML attributes (for example data attributes) to add to the exit this page container.
   */
  attributes?: Record<string, any>

  /**
   * Text announced by screen readers when Exit this Page has been activated
   * via the keyboard shortcut.
   * Defaults to "Loading.".
   */
  activatedText?: string

  /**
   * Text announced by screen readers when the keyboard shortcut has timed out
   * without successful activation.
   * Defaults to "Exit this page expired.".
   */
  timedOutText?: string

  /**
   * Text announced by screen readers when the user must press Shift two more
   * times to activate the button.
   * Defaults to "Shift, press 2 more times to exit.".
   */
  pressTwoMoreTimesText?: string

  /**
   * Text announced by screen readers when the user must press Shift one more
   * time to activate the button.
   * Defaults to "Shift, press 1 more time to exit.".
   */
  pressOneMoreTimeText?: string
}>

/**
 * GOV.UK Exit This Page component.
 *
 * A safety feature providing a quick escape route. Use it on pages with sensitive
 * information where users may need to hide what they're viewing quickly.
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
export const GovUKExitThisPage = nunjucksComponent<GovUKExitThisPage>('govukExitThisPage', {
  render: (props, nunjucksEnv) => {
    const params: Record<string, any> = {
      id: props.id,
      text: props.html ? undefined : props.text,
      html: props.html,
      redirectUrl: props.redirectUrl,
      classes: props.classes,
      attributes: props.attributes,
      activatedText: props.activatedText,
      timedOutText: props.timedOutText,
      pressTwoMoreTimesText: props.pressTwoMoreTimesText,
      pressOneMoreTimeText: props.pressOneMoreTimeText,
    }

    return nunjucksEnv.render('govuk/components/exit-this-page/template.njk', { params })
  },
})

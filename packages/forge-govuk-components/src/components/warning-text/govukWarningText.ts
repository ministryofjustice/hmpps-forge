import { BlockDefinition, ResolvableString } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Warning Text component.
 *
 * Use this to display important warnings to users. Renders with an exclamation mark
 * icon and bold text styling following the GOV.UK Design System.
 *
 * @see https://design-system.service.gov.uk/components/warning-text/
 * @example
 * ```typescript
 * GovUKWarningText({
 *   text: 'You can be fined up to £5,000 if you do not register.',
 * })
 * ```
 */
export interface GovUKWarningText extends BlockDefinition {
  /** Plain text content for the warning. Required unless html is provided. */
  text?: ResolvableString

  /** HTML content for the warning. Takes precedence over text. */
  html?: ResolvableString

  /** Child blocks to render in the warning. Takes precedence over text/html. */
  blocks?: BlockDefinition[]

  /** Fallback text for the warning icon (for screen readers). Defaults to "Warning". */
  iconFallbackText?: ResolvableString

  /** Additional CSS classes for the warning text container */
  classes?: ResolvableString

  /** Custom HTML attributes for the warning text container */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Warning Text component.
 *
 * Use this to display important warnings to users. Renders with an exclamation mark
 * icon and bold text styling following the GOV.UK Design System.
 *
 * @see https://design-system.service.gov.uk/components/warning-text/
 * @example
 * ```typescript
 * GovUKWarningText({
 *   text: 'You can be fined up to £5,000 if you do not register.',
 * })
 * ```
 */
export const GovUKWarningText = nunjucksComponent<GovUKWarningText>('govukWarningText', {
  render: (props, nunjucksEnv) => {
    const content = normaliseGovukTextHtmlContent({
      text: props.text,
      html: props.html,
      blocks: props.blocks,
    })
    const params: Record<string, any> = {
      text: content.text,
      html: content.html,
      iconFallbackText: props.iconFallbackText,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/warning-text/template.njk', { params })
  },
})

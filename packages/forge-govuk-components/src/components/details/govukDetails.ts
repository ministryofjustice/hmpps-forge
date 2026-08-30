import { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Details component.
 *
 * An expandable/collapsible section following the GOV.UK Design System patterns.
 * Renders as a `<details>` element with summary and content sections.
 *
 * @see https://design-system.service.gov.uk/components/details/
 * @example
 * ```typescript
 * GovUKDetails({
 *   summaryText: 'Help with nationality',
 *   text: 'We need to know your nationality so we can work out which elections you can vote in.',
 * })
 * ```
 */
export interface GovUKDetails {
  /** Text to display in the summary (clickable part). Required unless summaryHtml is provided. */
  summaryText?: string

  /** HTML to display in the summary (clickable part). Takes precedence over summaryText. */
  summaryHtml?: string

  /** Plain text content for the expandable section */
  text?: string

  /** HTML content for the expandable section. Takes precedence over text. */
  html?: string

  /** Child blocks to render in the expandable section. Takes precedence over text/html. */
  content?: BlockDefinition[]

  /** Whether the details should be expanded by default */
  open?: boolean

  /** ID attribute for the details element */
  id?: string

  /** Additional CSS classes for the details element */
  classes?: string

  /** Custom HTML attributes for the details element */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Details component.
 *
 * An expandable/collapsible section following the GOV.UK Design System patterns.
 * Renders as a `<details>` element with summary and content sections.
 *
 * @see https://design-system.service.gov.uk/components/details/
 * @example
 * ```typescript
 * GovUKDetails({
 *   summaryText: 'Help with nationality',
 *   text: 'We need to know your nationality so we can work out which elections you can vote in.',
 * })
 * ```
 */
export const GovUKDetails = nunjucksComponent<GovUKDetails>('govukDetails', {
  factory:
    ({ nunjucksEnv }) =>
    ({ props }) => {
      const content = normaliseGovukTextHtmlContent({
        text: props.text,
        html: props.html,
        blocks: props.content,
      })
      const params: Record<string, any> = {
        summaryText: props.summaryHtml ? undefined : props.summaryText,
        summaryHtml: props.summaryHtml,
        text: content.text,
        html: content.html,
        open: props.open,
        id: props.id,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('govuk/components/details/template.njk', { params })
    },
})

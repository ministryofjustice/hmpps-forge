import { BlockDefinition, ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Panel component.
 *
 * Use this to display a confirmation panel, typically shown on confirmation pages
 * at the end of a transaction. Renders with a turquoise background and white text.
 *
 * @see https://design-system.service.gov.uk/components/panel/
 * @example
 * ```typescript
 * GovUKPanel({
 *   titleText: 'Application complete',
 *   text: 'Your reference number is HDJ2123F',
 * })
 * ```
 */
export type GovUKPanel = ResolvableBlockProps<{
  /**
   * Plain text to use within the panel title.
   * Required unless `titleHtml` is provided.
   * If `titleHtml` is provided, this option will be ignored.
   */
  titleText?: string

  /**
   * HTML to use within the panel title.
   * Takes precedence over `titleText`.
   * If `titleHtml` is provided, the `titleText` option will be ignored.
   */
  titleHtml?: string

  /**
   * Heading level for the panel title, from 1 to 6.
   * Defaults to 1 (h1).
   */
  headingLevel?: number

  /**
   * Plain text content for the panel body.
   * Required unless `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: string

  /**
   * HTML content for the panel body.
   * Takes precedence over `text`.
   * If `html` is provided, the `text` option will be ignored.
   */
  html?: string

  /**
   * Child blocks to render in the panel body.
   * Takes precedence over `text` and `html`.
   */
  blocks?: BlockDefinition[]

  /**
   * Additional CSS classes for the panel container.
   */
  classes?: string

  /**
   * Custom HTML attributes (for example data attributes) to add to the panel container.
   */
  attributes?: Record<string, any>
}>

/**
 * GOV.UK Panel component.
 *
 * Use this to display a confirmation panel, typically shown on confirmation pages
 * at the end of a transaction. Renders with a turquoise background and white text.
 *
 * @see https://design-system.service.gov.uk/components/panel/
 * @example
 * ```typescript
 * GovUKPanel({
 *   titleText: 'Application complete',
 *   text: 'Your reference number is HDJ2123F',
 * })
 * ```
 */
export const GovUKPanel = nunjucksComponent<GovUKPanel>('govukPanel', {
  render: (props, nunjucksEnv) => {
    const content = normaliseGovukTextHtmlContent({
      text: props.text,
      html: props.html,
      blocks: props.blocks,
    })
    const params: Record<string, any> = {
      titleText: props.titleHtml ? undefined : props.titleText,
      titleHtml: props.titleHtml,
      headingLevel: props.headingLevel,
      text: content.text,
      html: content.html,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/panel/template.njk', { params })
  },
})

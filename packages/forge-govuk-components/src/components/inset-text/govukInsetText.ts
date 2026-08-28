import { BlockDefinition, ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * GOV.UK Inset Text component.
 *
 * Use this to differentiate a block of text from the surrounding content.
 * Useful for quotes, examples, or additional information that needs visual distinction.
 *
 * @see https://design-system.service.gov.uk/components/inset-text/
 * @example
 * ```typescript
 * GovUKInsetText({
 *   text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
 * })
 * ```
 */
export type GovUKInsetText = ResolvableBlockProps<{
  /**
   * Plain text content for the inset text.
   * Required unless `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: string

  /**
   * HTML content for the inset text.
   * Takes precedence over `text` if both are provided.
   * Use this when you need to include links or other HTML elements.
   */
  html?: string

  /**
   * Child blocks to render in the inset text.
   * Takes precedence over `text` and `html`.
   */
  blocks?: BlockDefinition[]

  /**
   * ID attribute to add to the inset text container.
   * Useful for linking to this specific section or for testing.
   */
  id?: string

  /**
   * Additional CSS classes to add to the inset text container.
   * Use this to apply custom styling or spacing classes.
   */
  classes?: string

  /**
   * HTML attributes (for example data attributes) to add to the inset text container.
   * Useful for adding custom data attributes or ARIA attributes.
   */
  attributes?: Record<string, any>
}>

/**
 * GOV.UK Inset Text component.
 *
 * Use this to differentiate a block of text from the surrounding content.
 * Useful for quotes, examples, or additional information that needs visual distinction.
 *
 * @see https://design-system.service.gov.uk/components/inset-text/
 * @example
 * ```typescript
 * GovUKInsetText({
 *   text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
 * })
 * ```
 */
export const GovUKInsetText = nunjucksComponent<GovUKInsetText>('govukInsetText', {
  render: (props, nunjucksEnv) => {
    const content = normaliseGovukTextHtmlContent({
      text: props.text,
      html: props.html,
      blocks: props.blocks,
    })
    const params: Record<string, any> = {
      text: content.text,
      html: content.html,
      id: props.id,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/inset-text/template.njk', { params })
  },
})

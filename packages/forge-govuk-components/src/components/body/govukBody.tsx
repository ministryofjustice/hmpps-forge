import { ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { jsxComponent, raw } from '@ministryofjustice/hmpps-forge/jsx-components'

type BodySize = 'l' | 's'

/**
 * GOV.UK styled paragraph.
 *
 * @see https://design-system.service.gov.uk/styles/paragraphs/
 * @example
 * ```typescript
 * GovUKBody({ text: 'Standard paragraph text' })
 * GovUKBody({ text: Format('Hello %1', name) })
 * GovUKBody({ text: 'Introductory lead paragraph', size: 'l' })
 * GovUKBody({ text: 'Small print text', size: 's' })
 * ```
 */
export type GovUKBody = ResolvableBlockProps<{
  /**
   * Text content for the paragraph. Supports dynamic expressions.
   *
   * **Rendered as raw HTML without sanitization** - escape untrusted data with
   * `Transformer.String.EscapeHtml()` before interpolating it.
   */
  text: string

  /** Paragraph size variant. 'l' for lead paragraph (24px), 's' for small (16px). Omit for default (19px). */
  size?: BodySize

  /** Additional CSS classes to append to the paragraph. */
  classes?: string

  /** HTML attributes to add to the paragraph element. */
  attributes?: Record<string, any>
}>

/**
 * GOV.UK styled paragraph.
 *
 * @see https://design-system.service.gov.uk/styles/paragraphs/
 * @example
 * ```typescript
 * GovUKBody({ text: 'Standard paragraph text' })
 * GovUKBody({ text: 'Introductory lead paragraph', size: 'l' })
 * ```
 */
export const GovUKBody = jsxComponent<GovUKBody>('govukBody', {
  render: props => {
    const className = [props.size ? `govuk-body-${props.size}` : 'govuk-body', props.classes]
      .filter(Boolean)
      .join(' ')

    return (
      <p class={className} {...props.attributes}>
        {raw(props.text)}
      </p>
    )
  },
})

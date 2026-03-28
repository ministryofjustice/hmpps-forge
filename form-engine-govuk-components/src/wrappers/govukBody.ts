import { HtmlBlock } from '@form-engine/registry/components/html'
import type { BasicBlockProps, ConditionalString } from '@form-engine/form/types/structures.type'

type BodySize = 'l' | 's'

export interface GovUKBodyProps extends BasicBlockProps {
  /** Text content for the paragraph. Supports dynamic expressions. */
  text: ConditionalString

  /** Paragraph size variant. 'l' for lead paragraph (24px), 's' for small (16px). Omit for default (19px). */
  size?: BodySize

  /** Additional CSS classes to append to the paragraph. */
  classes?: string

  /** HTML attributes to add to the wrapper element. */
  attributes?: Record<string, any>
}

/**
 * Creates a GOV.UK styled paragraph.
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
export function GovUKBody(props: GovUKBodyProps): HtmlBlock {
  const { text, size, classes, ...blockProps } = props

  const className = [size ? `govuk-body-${size}` : 'govuk-body', classes].filter(Boolean).join(' ')

  return HtmlBlock({
    ...blockProps,
    tag: 'p',
    classes: className,
    content: text,
  })
}

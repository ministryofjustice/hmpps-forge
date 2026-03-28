import { Format } from '@form-engine/form/builders'
import { HtmlBlock } from '@form-engine/registry/components/html'
import type { BasicBlockProps, ConditionalString } from '@form-engine/form/types/structures.type'

type HeadingSize = 'xl' | 'l' | 'm' | 's'
type HeadingLevel = 1 | 2 | 3 | 4

const defaultLevels: Record<HeadingSize, HeadingLevel> = {
  xl: 1,
  l: 1,
  m: 2,
  s: 3,
}

export interface GovUKHeadingProps extends BasicBlockProps {
  /** Heading text content. Supports dynamic expressions. */
  text: ConditionalString

  /** Visual size of the heading. Defaults to 'l'. */
  size?: HeadingSize

  /** HTML heading level (1-4). Defaults based on size: xl/l→h1, m→h2, s→h3. */
  level?: HeadingLevel

  /** Optional caption displayed above the heading. Matches the heading size class automatically. */
  caption?: ConditionalString

  /** Additional CSS classes to append to the heading. */
  classes?: string

  /** HTML attributes to add to the wrapper element. */
  attributes?: Record<string, any>
}

/**
 * Creates a GOV.UK heading with an optional caption.
 * Automatically pairs caption size to heading size (e.g. govuk-caption-l with govuk-heading-l).
 *
 * @see https://design-system.service.gov.uk/styles/headings/
 * @example
 * ```typescript
 * GovUKHeading({ text: 'Page title' })
 * GovUKHeading({ text: 'Page title', size: 'xl', caption: 'Section name' })
 * GovUKHeading({ text: Format('Goal: %1', goalTitle), size: 'm', level: 2 })
 * ```
 */
export function GovUKHeading(props: GovUKHeadingProps): HtmlBlock {
  const { text, size = 'l', level, caption, classes, ...blockProps } = props
  const headingLevel = level ?? defaultLevels[size]
  const headingClasses = classes ? `govuk-heading-${size} ${classes}` : `govuk-heading-${size}`

  const content = caption ? Format(`<span class="govuk-caption-${size}">%1</span>%2`, caption, text) : text

  return HtmlBlock({
    ...blockProps,
    tag: `h${headingLevel}`,
    classes: headingClasses,
    content,
  })
}

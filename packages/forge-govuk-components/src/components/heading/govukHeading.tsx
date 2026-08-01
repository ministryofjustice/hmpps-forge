import { BlockDefinition, ResolvableString } from '@ministryofjustice/hmpps-forge/core/components'
import { jsxComponent } from '@ministryofjustice/hmpps-forge/jsx-components'

type HeadingSize = 'xl' | 'l' | 'm' | 's'
type HeadingLevel = 1 | 2 | 3 | 4
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4'

const defaultLevels: Record<HeadingSize, HeadingLevel> = {
  xl: 1,
  l: 1,
  m: 2,
  s: 3,
}

/**
 * GOV.UK heading with an optional caption.
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
export interface GovUKHeading extends BlockDefinition {
  /** Heading text content. Supports dynamic expressions. */
  text: ResolvableString

  /** Visual size of the heading. Defaults to 'l'. */
  size?: HeadingSize

  /** HTML heading level (1-4). Defaults based on size: xl/l→h1, m→h2, s→h3. */
  level?: HeadingLevel

  /** Optional caption displayed above the heading. Matches the heading size class automatically. */
  caption?: ResolvableString

  /** Additional CSS classes to append to the heading. */
  classes?: string

  /** HTML attributes to add to the heading element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK heading with an optional caption.
 * Automatically pairs caption size to heading size (e.g. govuk-caption-l with govuk-heading-l).
 *
 * @see https://design-system.service.gov.uk/styles/headings/
 * @example
 * ```typescript
 * GovUKHeading({ text: 'Page title' })
 * GovUKHeading({ text: 'Page title', size: 'xl', caption: 'Section name' })
 * ```
 */
export const GovUKHeading = jsxComponent<GovUKHeading>('govukHeading', {
  render: props => {
    // Evaluation widens the literal prop types, so pin the tag back to the union
    const size = (props.size ?? 'l') as HeadingSize
    const Tag = `h${props.level ?? defaultLevels[size]}` as HeadingTag
    const className = props.classes ? `govuk-heading-${size} ${props.classes}` : `govuk-heading-${size}`

    return (
      <Tag class={className} {...props.attributes}>
        {props.caption && <span class={`govuk-caption-${size}`}>{props.caption}</span>}
        {props.text}
      </Tag>
    )
  },
})

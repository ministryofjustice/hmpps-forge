import { BlockDefinition, ResolvableArray, ResolvableString } from '@ministryofjustice/hmpps-forge/core/components'
import { jsxComponent } from '@ministryofjustice/hmpps-forge/jsx-components'

type ListType = 'bullet' | 'number'

/**
 * GOV.UK styled list rendered from an array of string values.
 *
 * @see https://design-system.service.gov.uk/styles/lists/
 * @example
 * ```typescript
 * GovUKList({ items: Data('suggestions'), style: 'bullet' })
 * GovUKList({ items: Data('steps'), style: 'number', spaced: true })
 * GovUKList({ items: Data('areas').each(Iterator.Map(Item().path('name'))) })
 * ```
 */
export interface GovUKList extends BlockDefinition {
  /** The list items. An array of strings, or a dynamic expression that evaluates to one. */
  items: ResolvableArray<ResolvableString>

  /** List style. 'bullet' for unordered, 'number' for ordered. Omit for plain list. */
  style?: ListType

  /** Whether to add extra spacing between list items. */
  spaced?: boolean

  /** Additional CSS classes to append to the list. */
  classes?: string

  /** HTML attributes to add to the list element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK styled list rendered from an array of string values.
 *
 * @see https://design-system.service.gov.uk/styles/lists/
 * @example
 * ```typescript
 * GovUKList({ items: Data('suggestions'), style: 'bullet' })
 * GovUKList({ items: ['First step', 'Second step'], style: 'number' })
 * ```
 */
export const GovUKList = jsxComponent<GovUKList>('govukList', {
  render: props => {
    // Evaluation widens the literal prop types, so pin the type back to the union
    const style = props.style as ListType | undefined
    const Tag = style === 'number' ? 'ol' : 'ul'
    const className = ['govuk-list', style && `govuk-list--${style}`, props.spaced && 'govuk-list--spaced', props.classes]
      .filter(Boolean)
      .join(' ')

    return (
      <Tag class={className} {...props.attributes}>
        {props.items.map(item => (
          <li>{item}</li>
        ))}
      </Tag>
    )
  },
})

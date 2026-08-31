import { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { jsxComponent, raw } from '@ministryofjustice/hmpps-forge/jsx-components'

type ListType = 'bullet' | 'number'

/**
 * GOV.UK styled list. Items can be strings, child blocks, or a mix of the two.
 *
 * @see https://design-system.service.gov.uk/styles/lists/
 * @example
 * ```typescript
 * GovUKList({ items: Data('suggestions'), style: 'bullet' })
 * GovUKList({ items: Data('steps'), style: 'number', spaced: true })
 * GovUKList({
 *   items: [
 *     GovUKBody({ text: 'A paragraph item' }),
 *     HtmlBlock({ tag: 'a', attributes: { href: '/help' }, content: 'A link item' }),
 *   ],
 * })
 * ```
 */
export interface GovUKList {
  /**
   * The list items - strings, child blocks, or a dynamic expression evaluating to an array.
   *
   * **String items are rendered as raw HTML without sanitization** - escape untrusted data
   * with `Transformer.String.EscapeHtml()` before interpolating it.
   */
  items: (string | BlockDefinition)[]

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
 * GOV.UK styled list. Items can be strings, child blocks, or a mix of the two.
 *
 * @see https://design-system.service.gov.uk/styles/lists/
 * @example
 * ```typescript
 * GovUKList({ items: Data('suggestions'), style: 'bullet' })
 * GovUKList({ items: ['First step', GovUKBody({ text: 'Second step' })], style: 'number' })
 * ```
 */
export const GovUKList = jsxComponent<GovUKList>('govukList', {
  factory:
    () =>
    props => {
      // Evaluation widens the literal prop types, so pin the type back to the union
      const style = props.style as ListType | undefined
      const Tag = style === 'number' ? 'ol' : 'ul'
      const className = ['govuk-list', style && `govuk-list--${style}`, props.spaced && 'govuk-list--spaced', props.classes]
        .filter(Boolean)
        .join(' ')

      return (
        <Tag class={className} {...props.attributes}>
          {props.items.map(item => (
            <li>{raw(typeof item === 'object' && item !== null ? item.html : item)}</li>
          ))}
        </Tag>
      )
    },
})

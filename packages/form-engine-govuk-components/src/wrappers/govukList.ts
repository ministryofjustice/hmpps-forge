import { Item } from '@form-engine/form/builders'
import { Iterator } from '@form-engine/form/builders/IteratorBuilder'
import { HtmlBlock } from '@form-engine/registry/components/html'
import type { BasicBlockProps } from '@form-engine/form/types/structures.type'
import type { ChainableExpr, ChainableIterable, ChainableRef } from '@form-engine/form/builders'

type ListType = 'bullet' | 'number'

type IterableDataSource = ChainableRef | ChainableExpr<any> | ChainableIterable

export interface GovUKListProps extends BasicBlockProps {
  /** Data source that evaluates to an array of string values. */
  items: IterableDataSource

  /** List style. 'bullet' for unordered, 'number' for ordered. Omit for plain list. */
  type?: ListType

  /** Whether to add extra spacing between list items. */
  spaced?: boolean

  /** Additional CSS classes to append to the list. */
  classes?: string

  /** HTML attributes to add to the wrapper element. */
  attributes?: Record<string, any>
}

/**
 * Creates a GOV.UK styled list from a dynamic data source.
 * Each item in the data is rendered as a `<li>` within a styled `<ul>` or `<ol>`.
 *
 * @see https://design-system.service.gov.uk/styles/lists/
 * @example
 * ```typescript
 * GovUKList({ items: Data('suggestions'), type: 'bullet' })
 * GovUKList({ items: Data('steps'), type: 'number', spaced: true })
 * GovUKList({ items: Data('areas').each(Iterator.Map(Item().path('name'))) })
 * ```
 */
export function GovUKList(props: GovUKListProps): HtmlBlock {
  const { items, type, spaced, classes, ...blockProps } = props

  const tag = type === 'number' ? 'ol' : 'ul'

  const classNames = ['govuk-list', type && `govuk-list--${type}`, spaced && 'govuk-list--spaced', classes]
    .filter(Boolean)
    .join(' ')

  return HtmlBlock({
    ...blockProps,
    tag,
    classes: classNames,
    content: items.each(Iterator.Map(HtmlBlock({ tag: 'li', content: Item().value() }))),
  })
}

import { component } from '../../components/component'
import { StructureType } from '../../authoring/types/enums'
import { isRenderedBlock } from '../../components/typeguards'
import { escapeHtmlEntities } from '../sanitize'
import type {
  BlockDefinition,
  ResolvableArray,
  ResolvableString,
  RenderedBlock,
} from '../../components/types/structures.type'

/**
 * Collection Block component.
 * Renders repeated blocks based on a collection expression.
 *
 * The `collection` property accepts any chainable expression that evaluates to an array of blocks.
 * This works with the Iterator pattern (e.g., `Data('items').each(Iterator.Map(...))`)
 *
 * @template T - Type of blocks in the collection array
 * @template F - Type of blocks in the fallback array (defaults to T)
 *
 * @example
 * ```typescript
 * CollectionBlock({
 *   collection: Data('tasks').each(Iterator.Map({
 *     template: MojCard({
 *       heading: Item().path('title'),
 *       content: Item().path('description'),
 *     }),
 *   })),
 *   fallback: [GovUKInsetText({ html: 'No tasks available' })],
 *   classes: 'govuk-!-margin-bottom-6',
 * })
 * ```
 */
export interface CollectionBlock<T = BlockDefinition, F = T> extends BlockDefinition {
  /**
   * The blocks to render: an expression that evaluates to an array of blocks,
   * or a static array of block definitions.
   * @example Data('items').each(Iterator.Map({ template: GovUKInsetText({ ... }) }))
   * @example [GovUKInsetText({ html: 'First' }), GovUKInsetText({ html: 'Second' })]
   */
  collection: ResolvableArray<T>

  /**
   * Fallback blocks to render when the collection is empty.
   * @example [GovUKInsetText({ html: 'No items found' })]
   */
  fallback?: F[]

  /**
   * HTML tag to render content within. When set, `classes` and `attributes`
   * are applied directly to this element instead of a wrapper `<div>`.
   * @example 'ul'
   */
  tag?: string

  /**
   * Additional CSS classes to apply to the wrapper element.
   * @example 'govuk-!-margin-bottom-6'
   */
  classes?: ResolvableString

  /**
   * Custom HTML attributes for the wrapper element.
   * @example { 'data-module': 'collection-list' }
   */
  attributes?: Record<string, any>
}

/**
 * Runtime representation of a collection block after evaluation.
 * The `collection` property contains the rendered blocks from applying the template.
 *
 * Note: This doesn't extend EvaluatedBlock<CollectionBlock> because the
 * `collection` property transforms from an expression to RenderedBlock[]
 * during evaluation - a transformation the generic type can't express.
 */
export interface EvaluatedCollectionBlock {
  type: typeof StructureType.BLOCK
  variant: 'collection-block'

  /** The rendered blocks from applying the template to each collection item */
  collection?: RenderedBlock[]

  /** Fallback blocks rendered when the collection is empty */
  fallback?: RenderedBlock[]

  /** HTML tag for the wrapper element (defaults to div when classes/attributes are present) */
  tag?: string

  /** Additional CSS classes applied to the wrapper element */
  classes?: string

  /** Custom HTML attributes for the wrapper element */
  attributes?: Record<string, string>
}

/**
 * Extracts a string value from a collection item that could be:
 * - A rendered block (with .html and .block properties)
 * - A plain string
 * - An array of either
 */
const extractItemValue = (item: unknown): string => {
  if (Array.isArray(item)) {
    return item.map(i => extractItemValue(i)).join('')
  }

  if (isRenderedBlock(item)) {
    return item.html
  }

  return (item as string) ?? ''
}

/**
 * Render function for collection-block.
 */
const renderCollectionBlock = (block: EvaluatedCollectionBlock): string => {
  let content = ''

  const hasItems = block.collection && block.collection.length > 0

  if (hasItems) {
    content = block.collection!.map(item => extractItemValue(item)).join('')
  } else if (block.fallback && block.fallback.length > 0) {
    content = block.fallback.map(item => extractItemValue(item)).join('')
  }

  const hasWrapper = block.tag || block.classes || block.attributes

  if (hasWrapper) {
    const element = block.tag ?? 'div'
    const classAttr = block.classes ? ` class="${escapeHtmlEntities(block.classes)}"` : ''
    const customAttrs = block.attributes
      ? Object.entries(block.attributes)
          .map(([key, value]) => ` ${escapeHtmlEntities(key)}="${escapeHtmlEntities(String(value))}"`)
          .join('')
      : ''

    return `<${element}${classAttr}${customAttrs}>${content}</${element}>`
  }

  return content
}

/**
 * Collection Block component.
 * Renders repeated blocks based on a collection expression.
 *
 * The `collection` property accepts any chainable expression that evaluates to an array of blocks.
 * This works with the Iterator pattern (e.g., `Data('items').each(Iterator.Map(...))`)
 *
 * @example
 * ```typescript
 * CollectionBlock({
 *   collection: Data('tasks').each(Iterator.Map({
 *     template: MojCard({
 *       heading: Item().path('title'),
 *       content: Item().path('description'),
 *     }),
 *   })),
 *   fallback: [GovUKInsetText({ html: 'No tasks available' })],
 *   classes: 'govuk-!-margin-bottom-6',
 * })
 * ```
 */
export const CollectionBlock = component<CollectionBlock>('collection-block', {
  // Cast to the evaluated shape because the generic EvaluatedBlock<CollectionBlock> type
  // cannot express that `collection` transforms from an expression to RenderedBlock[].
  render: props => renderCollectionBlock(props as unknown as EvaluatedCollectionBlock),
})

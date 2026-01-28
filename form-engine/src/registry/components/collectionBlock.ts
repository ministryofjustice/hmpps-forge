import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { ChainableExpr, block as blockBuilder } from '@form-engine/form/builders'
import { StructureType } from '@form-engine/form/types/enums'
import { isRenderedBlock } from '@form-engine/form/typeguards/structures'
import { escapeHtmlEntities } from '@form-engine/core/utils/sanitize'
import { BasicBlockProps, BlockDefinition, ConditionalString, RenderedBlock } from '../../form/types/structures.type'

/**
 * Props for the CollectionBlock component.
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
 *     template: MojCard({ ... }),
 *   })),
 *   fallback: [GovUKInsetText({ html: 'No tasks available' })],
 * })
 * ```
 */
export interface CollectionBlockProps<T = BlockDefinition, F = T> extends BasicBlockProps {
  /**
   * Expression that evaluates to an array of blocks to render.
   * @example Data('items').each(Iterator.Map({ template: GovUKInsetText({ ... }) }))
   */
  collection: ChainableExpr<T[]>

  /**
   * Fallback blocks to render when the collection is empty.
   * @example [GovUKInsetText({ html: 'No items found' })]
   */
  fallback?: F[]

  /**
   * Additional CSS classes to apply to wrapper div.
   * @example 'govuk-!-margin-bottom-6'
   */
  classes?: ConditionalString

  /**
   * Custom HTML attributes for wrapper div.
   * @example { 'data-module': 'collection-list' }
   */
  attributes?: Record<string, any>
}

/**
 * Collection Block Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `CollectionBlockProps` type or the `CollectionBlock()` wrapper function instead.
 *
 * @template T - Type of blocks in the collection array
 * @template F - Type of blocks in the fallback array (defaults to T)
 */
export interface CollectionBlock<T = BlockDefinition, F = T> extends BlockDefinition, CollectionBlockProps<T, F> {
  /** Component variant identifier */
  variant: 'collection-block'
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

  /** Additional CSS classes applied to wrapper div */
  classes?: string

  /** Custom HTML attributes for wrapper div */
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
 * Cast to any because the generic EvaluatedBlock<CollectionBlock> type
 * cannot express that `collection` transforms from an expression to RenderedBlock[].
 */
const renderCollectionBlock = async (block: EvaluatedCollectionBlock): Promise<string> => {
  let content = ''

  const hasItems = block.collection && block.collection.length > 0

  if (hasItems) {
    content = block.collection!.map(item => extractItemValue(item)).join('')
  } else if (block.fallback && block.fallback.length > 0) {
    content = block.fallback.map(item => extractItemValue(item)).join('')
  }

  const hasWrapper = block.classes || block.attributes

  if (hasWrapper) {
    const classAttr = block.classes ? ` class="${escapeHtmlEntities(block.classes)}"` : ''
    const customAttrs = block.attributes
      ? Object.entries(block.attributes)
          .map(([key, value]) => ` ${escapeHtmlEntities(key)}="${escapeHtmlEntities(String(value))}"`)
          .join('')
      : ''

    return `<div${classAttr}${customAttrs}>${content}</div>`
  }

  return content
}

export const collectionBlock = buildComponent<CollectionBlock<BlockDefinition>>(
  'collection-block',
  renderCollectionBlock as any,
)

/**
 * Creates a Collection Block for rendering repeated blocks based on a collection.
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
export function CollectionBlock<T = BlockDefinition, F = T>(props: CollectionBlockProps<T, F>): CollectionBlock<T, F> {
  return blockBuilder<CollectionBlock<T, F>>({ ...props, variant: 'collection-block' })
}

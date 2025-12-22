import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { ChainableExpr } from '@form-engine/form/builders'
import { StructureType } from '@form-engine/form/types/enums'
import { isRenderedBlock } from '@form-engine/form/typeguards/structures'
import { BlockDefinition, ConditionalString, RenderedBlock } from '../../form/types/structures.type'

/**
 * Collection block component for rendering repeated blocks based on a collection.
 *
 * The `collection` property accepts any chainable expression that evaluates to an array of blocks.
 * This works with the Iterator pattern (e.g., `Data('items').each(Iterator.Map(...))`)
 *
 * @template T - Type of blocks in the collection array
 * @template F - Type of blocks in the fallback array (defaults to T)
 */
export interface CollectionBlock<T = BlockDefinition, F = T> extends BlockDefinition {
  variant: 'collection-block'

  /** Expression that evaluates to an array of blocks to render */
  collection: ChainableExpr<T[]>

  /** Fallback blocks to render when the collection is empty */
  fallback?: F[]

  /** Additional CSS classes to apply to wrapper div (optional) */
  classes?: ConditionalString

  /** Custom HTML attributes for wrapper div (optional) */
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
    const classAttr = block.classes ? ` class="${block.classes}"` : ''
    const customAttrs = block.attributes
      ? Object.entries(block.attributes)
          .map(([key, value]) => ` ${key}="${value}"`)
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

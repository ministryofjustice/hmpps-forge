import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { CollectionExpr } from '@form-engine/form/types/expressions.type'
import { StructureType } from '@form-engine/form/types/enums'
import { BlockDefinition, ConditionalString, RenderedBlock } from '../../form/types/structures.type'

/**
 * Collection block component for rendering repeated blocks based on a collection.
 *
 * @template T - Type of blocks in the template array
 * @template F - Type of blocks in the fallback array (defaults to T)
 */
export interface CollectionBlock<T = BlockDefinition, F = T> extends BlockDefinition {
  variant: 'collection-block'

  collection: CollectionExpr<T, F>

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
 * `collection` property transforms from CollectionExpr to RenderedBlock[]
 * during evaluation - a transformation the generic type can't express.
 */
export interface EvaluatedCollectionBlock {
  type: typeof StructureType.BLOCK
  variant: 'collection-block'

  /** The rendered blocks from applying the template to each collection item */
  collection?: RenderedBlock[]

  /** Additional CSS classes applied to wrapper div */
  classes?: string

  /** Custom HTML attributes for wrapper div */
  attributes?: Record<string, string>
}

/**
 * Render function for collection-block.
 * Cast to any because the generic EvaluatedBlock<CollectionBlock> type
 * cannot express that `collection` transforms from CollectionExpr to RenderedBlock[].
 */
const renderCollectionBlock = async (block: EvaluatedCollectionBlock): Promise<string> => {
  let content = ''

  if (block.collection && block.collection.length > 0) {
    content = block.collection.map(b => b.html).join('')
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

export const collectionBlock = buildComponent<CollectionBlock>('collection-block', renderCollectionBlock as any)

import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import { CollectionExpr } from '@form-engine/form/types/expressions.type'
import {
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
  RenderedBlock,
} from '../../../../form/types/structures.type'

// TODO: I need to come back to this once I know more about how the collections are unpacked
//  at runtime. Just ignore if this is dumb for now.

/**
 * Collection block component for rendering repeated blocks based on a collection.
 */
export interface CollectionBlock<T = BlockDefinition> extends BlockDefinition {
  variant: 'collection-block'

  collection: CollectionExpr<T>

  /** Additional CSS classes to apply to wrapper div (optional) */
  classes?: ConditionalString

  /** Custom HTML attributes for wrapper div (optional) */
  attributes?: Record<string, any>
}

/**
 * Runtime representation of a collection block after evaluation.
 * Contains the generated blocks from applying the template to the collection.
 */
export interface EvaluatedCollectionBlock extends Omit<EvaluatedBlock<CollectionBlock>, 'blocks'> {
  /** The blocks generated from applying the template to each collection item */
  blocks?: RenderedBlock[]

  /** Rendered fallback block when collection is empty */
  fallbackBlock?: RenderedBlock
}

export const collectionBlock = buildComponent<CollectionBlock>(
  'collection-block',
  async (block: EvaluatedCollectionBlock) => {
    let content = ''

    if (block.blocks && block.blocks.length > 0) {
      content = block.blocks.map(b => b.html).join('')
    } else if (block.fallbackBlock) {
      content = block.fallbackBlock.html
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
  },
)

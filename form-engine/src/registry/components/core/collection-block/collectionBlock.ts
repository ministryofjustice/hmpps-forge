import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import {
  BlockDefinition,
  CollectionBlockDefinition,
  ConditionalString,
  EvaluatedBlock,
  RenderedBlock,
} from '../../../../form/types/structures.type'

/**
 * Collection block component for rendering repeated blocks based on a collection.
 */
export interface CollectionBlock<T = BlockDefinition> extends CollectionBlockDefinition<T> {
  variant: 'collection-block'

  /** Optional fallback block to render when collection is empty */
  fallbackTemplate?: T

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

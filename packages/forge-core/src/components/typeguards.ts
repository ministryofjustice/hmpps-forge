import { BlockDefinition, FieldBlockDefinition, RenderedBlock } from './types/structures.type'
import { BlockType, StructureType } from '../authoring/types/enums'

function isBlockDefinition(obj: any): obj is BlockDefinition {
  return obj != null && obj.type === StructureType.BLOCK
}

export function isFieldBlockDefinition(obj: any): obj is FieldBlockDefinition {
  return isBlockDefinition(obj) && obj.blockType === BlockType.FIELD
}

export function isRenderedBlock(obj: unknown): obj is RenderedBlock {
  return obj != null &&
    typeof obj === 'object' &&
    'html' in obj &&
    typeof obj.html === 'string' &&
    'block' in obj &&
    isBlockDefinition(obj.block)
}

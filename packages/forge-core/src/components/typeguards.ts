import { BlockDefinition, FieldBlockDefinition, RenderedBlock } from './types/structures.type'
import { ComponentCallType } from '../shared/taxonomy'

function isBlockDefinition(obj: any): obj is BlockDefinition {
  return obj != null && typeof obj._forge === 'string' && obj._forge.startsWith('component.call.')
}

export function isFieldBlockDefinition(obj: any): obj is FieldBlockDefinition {
  return obj != null && obj._forge === ComponentCallType.FIELD
}

export function isRenderedBlock(obj: unknown): obj is RenderedBlock {
  return obj != null &&
    typeof obj === 'object' &&
    'html' in obj &&
    typeof obj.html === 'string' &&
    'block' in obj &&
    isBlockDefinition(obj.block)
}

import type { RenderBlock } from '../../../framework/rendering/types'

export function isRenderBlock(obj: unknown): obj is RenderBlock {
  return obj != null && typeof obj === 'object' && 'blockType' in obj && 'variant' in obj
}

import type { RenderBlock } from '../../../framework/rendering/types'

export const RENDER_BLOCK_BRAND: symbol = Symbol.for('forge:RenderBlock')

export function isRenderBlock(obj: unknown): obj is RenderBlock {
  return obj != null && typeof obj === 'object' && RENDER_BLOCK_BRAND in obj
}

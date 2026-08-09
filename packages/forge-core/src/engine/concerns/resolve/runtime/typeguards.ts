import type { RenderBlock } from '../../../../framework/types/rendering.type'
import { RENDER_BLOCK_BRAND } from '../../render/contracts/renderBlock.brand'

export function isRenderBlock(obj: unknown): obj is RenderBlock {
  return obj != null && typeof obj === 'object' && RENDER_BLOCK_BRAND in obj
}

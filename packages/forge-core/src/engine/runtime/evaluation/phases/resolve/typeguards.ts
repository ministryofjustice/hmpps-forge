import type { RenderBlock } from '../../../../../framework/rendering/types'
import { RENDER_BLOCK_BRAND } from '../../../../contracts/compiled/renderBlock.brand'

export function isRenderBlock(obj: unknown): obj is RenderBlock {
  return obj != null && typeof obj === 'object' && RENDER_BLOCK_BRAND in obj
}

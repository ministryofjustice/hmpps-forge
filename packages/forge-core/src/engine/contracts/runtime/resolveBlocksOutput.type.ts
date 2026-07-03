import type { RenderBlock } from '../../../framework/rendering/types'

export interface ResolveBlocksOutput {
  readonly blocks: readonly RenderBlock[]
  readonly step: Record<string, unknown>
  readonly ancestors: readonly Record<string, unknown>[]
}

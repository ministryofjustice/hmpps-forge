import type { RenderBlock } from '../../../../framework/types/rendering.type'

export interface ResolveBlocksOutput {
  readonly blocks: readonly RenderBlock[]
  readonly step: Record<string, unknown>
  readonly ancestors: readonly Record<string, unknown>[]
}

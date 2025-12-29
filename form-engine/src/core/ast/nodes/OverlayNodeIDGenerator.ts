import { AstNodeId, NodeId, PseudoNodeId } from '@form-engine/core/types/engine.type'
import { NodeIDCategory, NodeIDGenerator } from './NodeIDGenerator'

/**
 * Overlay ID generator that delegates to main and pending.
 * - New IDs are generated from pending
 * - Pending starts from main's current counter values
 * - flushIntoMain() syncs pending counters back to main
 */
export default class OverlayNodeIDGenerator extends NodeIDGenerator {
  private readonly pending = new NodeIDGenerator()

  constructor(private readonly main: NodeIDGenerator) {
    super()
    this.pending.syncFrom(main)
  }

  next(category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST): AstNodeId

  next(category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO): PseudoNodeId

  next(category: NodeIDCategory): NodeId {
    return this.pending.next(category as NodeIDCategory.COMPILE_AST)
  }

  getCurrentCount(category: NodeIDCategory): number {
    return this.pending.getCurrentCount(category)
  }

  reset(category?: NodeIDCategory): void {
    this.pending.reset(category)
  }

  clone(): NodeIDGenerator {
    throw new Error('Cannot clone an OverlayNodeIDGenerator - clone the main generator instead')
  }

  flushIntoMain(): void {
    this.main.syncFrom(this.pending)
  }

  /**
   * Sync counter values into pending (not parent's counters)
   * This ensures nested overlays flush correctly into this overlay
   */
  syncFrom(source: NodeIDGenerator): void {
    this.pending.syncFrom(source)
  }

  /**
   * Return pending's counter entries for syncing
   * This ensures nested overlays sync from the correct source
   */
  getCounterEntries(): [NodeIDCategory, number][] {
    return this.pending.getCounterEntries()
  }
}

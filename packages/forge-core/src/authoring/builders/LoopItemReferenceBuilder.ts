import { BuilderType } from '../types/enums'
import { ItemReferenceBuilder } from './ScopedReferenceBuilder'

/**
 * Immutable builder for references to the item a loop is iterating, reached
 * via Loop.Item(). Emits the canonical `['@loop', level, 'item', ...]` path
 * shape that Item() references are also rewritten into at AST build.
 *
 * Loop nesting is navigated on Loop itself (Loop.Parent.Item()), so unlike
 * Item() this builder has no parent accessor.
 *
 * @internal Exposed to authors via the ChainableLoopItemRef interface.
 */
export class LoopItemReferenceBuilder extends ItemReferenceBuilder {
  readonly _forge = BuilderType.LOOP_ITEM as const

  private constructor(level: number) {
    super(level)
  }

  /**
   * Create a loop item reference builder at the specified nesting level.
   * Level 0 is the current loop's item, level 1 is the parent loop's item, etc.
   */
  static create(level: number): LoopItemReferenceBuilder {
    return new LoopItemReferenceBuilder(level)
  }

  protected itemPath(): string[] {
    return ['@loop', this.level.toString(), 'item']
  }
}

import { resolvesMarker } from '../types/expressions.type'
import { ReferenceBuilder } from './ReferenceBuilder'
import { splitKey } from './utils/splitKey'
import type { ReferenceExpr } from '../types/expressions.type'

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
export class LoopItemReferenceBuilder {
  // Type-only ChainableExpression brand - never set at runtime.
  declare readonly [resolvesMarker]: any

  readonly nodeKind = 'forge-builder' as const

  private readonly level: number

  private constructor(level: number) {
    this.level = level
  }

  /**
   * Create a loop item reference builder at the specified nesting level.
   * Level 0 is the current loop's item, level 1 is the parent loop's item, etc.
   */
  static create(level: number): LoopItemReferenceBuilder {
    return new LoopItemReferenceBuilder(level)
  }

  /**
   * Build the whole-item reference expression, so a bare Loop.Item() in a
   * value position means the same as Loop.Item().value().
   * Called automatically by finaliseBuilders().
   */
  build(): ReferenceExpr {
    return this.value().build()
  }

  /**
   * Get a sub-property of the loop item.
   * Supports dot notation: .path('user.address.city')
   *
   * @example
   * Loop.Item().path('name')
   * Loop.Item().path('address.postcode')
   */
  path(key: string): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'item', ...splitKey(key)])
  }

  /**
   * Get the full value of the loop item.
   *
   * @example
   * Loop.Item().value()  // Returns the entire item
   */
  value(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'item'])
  }

  /**
   * Get the key when iterating over an object.
   * Only available when iterating over object entries (not arrays).
   *
   * @example
   * // Given: { accommodation: { score: 5 }, finances: { score: 3 } }
   * Data('scores').each(Iterator.Map({
   *   slug: Loop.Item().key(),     // 'accommodation', 'finances'
   *   score: Loop.Item().path('score')  // 5, 3
   * }))
   */
  key(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'item', '@key'])
  }
}

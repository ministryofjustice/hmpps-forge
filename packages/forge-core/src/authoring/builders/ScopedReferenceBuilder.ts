import { ReferenceBuilder } from './ReferenceBuilder'
import { splitKey } from './utils/splitKey'
import type { ReferenceExpr } from '../types/expressions.type'

/**
 * Immutable builder for creating item references within iterator contexts.
 *
 * Provides methods to navigate hierarchical data structures and access
 * properties of items during iteration. This is primarily used with the
 * Item() reference to access item data in collection blocks.
 *
 * @example
 * // Access a property of the current item
 * Item().path('name')  // -> ['@scope', '0', 'name']
 *
 * // Access the full item value
 * Item().value()  // -> ['@scope', '0']
 *
 * // Navigate to the outer item in nested iterators
 * Item().parent.path('groupId')  // -> ['@scope', '1', 'groupId']
 *
 * // Chain with pipe and match
 * Item().path('price').pipe(Transformer.Number.Parse).match(Condition.Number.GreaterThan(0))
 *
 * @internal Exposed to authors via the ChainableScopedRef interface.
 */
export class ScopedReferenceBuilder {
  readonly nodeKind = 'forge-builder' as const

  private readonly level: number

  private constructor(level: number) {
    this.level = level
  }

  /**
   * Create a scoped reference builder at the specified nesting level.
   * Level 0 is the current item, level 1 is the parent, etc.
   */
  static create(level: number): ScopedReferenceBuilder {
    return new ScopedReferenceBuilder(level)
  }

  /**
   * Navigate to the outer iterator's item in nested iterators.
   * Returns a new builder at the next item level up.
   *
   * @example
   * Item().parent.path('groupId')  // Access the outer item's groupId
   * Item().parent.parent.path('orgId')  // Access the next outer item's orgId
   */
  get parent(): ScopedReferenceBuilder {
    return new ScopedReferenceBuilder(this.level + 1)
  }

  /**
   * Build the whole-item reference expression, so a bare Item() in a value
   * position means the same as Item().value().
   * Called automatically by finaliseBuilders().
   */
  build(): ReferenceExpr {
    return this.value().build()
  }

  /**
   * Get a sub-property of the collection item.
   * Supports dot notation: .path('user.address.city')
   *
   * @example
   * Item().path('name')
   * Item().path('address.postcode')
   */
  path(key: string): ReferenceBuilder {
    return ReferenceBuilder.create(['@scope', this.level.toString(), ...splitKey(key)])
  }

  /**
   * Get the full value of the collection item.
   *
   * @example
   * Item().value()  // Returns the entire item object
   */
  value(): ReferenceBuilder {
    return ReferenceBuilder.create(['@scope', this.level.toString()])
  }

  /**
   * Get the key when iterating over an object.
   * Only available when iterating over object entries (not arrays).
   *
   * @example
   * // Given: { accommodation: { score: 5 }, finances: { score: 3 } }
   * Data('scores').each(Iterator.Map({
   *   slug: Item().key(),     // 'accommodation', 'finances'
   *   score: Item().path('score')  // 5, 3
   * }))
   */
  key(): ReferenceBuilder {
    return ReferenceBuilder.create(['@scope', this.level.toString(), '@key'])
  }
}

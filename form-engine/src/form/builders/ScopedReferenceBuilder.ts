import { ReferenceBuilder } from './ReferenceBuilder'

/**
 * Split a key string into path segments.
 * 'user.name' -> ['user', 'name']
 * 'simple' -> ['simple']
 */
const splitKey = (key: string): string[] => (key.includes('.') ? key.split('.') : [key])

/**
 * Immutable builder for creating references within collection contexts.
 *
 * Provides methods to navigate hierarchical data structures and access
 * properties of items during collection iteration. This is primarily used
 * with the Item() reference to access data in collection blocks.
 *
 * @example
 * // Access a property of the current item
 * Item().path('name')  // -> ['@scope', '0', 'name']
 *
 * // Access the full item value
 * Item().value()  // -> ['@scope', '0']
 *
 * // Access the current iteration index
 * Item().index()  // -> ['@scope', '0', '@index']
 *
 * // Navigate to parent in nested collections
 * Item().parent.path('groupId')  // -> ['@scope', '1', 'groupId']
 *
 * // Chain with pipe and match
 * Item().path('price').pipe(Transformer.Number.Parse).match(Condition.Number.GreaterThan(0))
 */
export class ScopedReferenceBuilder {
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
   * Navigate to the parent scope in nested collections.
   * Returns a new builder at the next level up.
   *
   * @example
   * Item().parent.path('groupId')  // Access parent item's groupId
   * Item().parent.parent.path('orgId')  // Access grandparent's orgId
   */
  get parent(): ScopedReferenceBuilder {
    return new ScopedReferenceBuilder(this.level + 1)
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
   * Get the current iteration index (0-based).
   *
   * @example
   * Item().index()  // Returns 0, 1, 2, etc.
   * Format('Item %1', Item().index())  // "Item 0", "Item 1", etc.
   */
  index(): ReferenceBuilder {
    return ReferenceBuilder.create(['@scope', this.level.toString(), '@index'])
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

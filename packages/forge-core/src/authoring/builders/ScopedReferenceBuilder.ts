/* eslint-disable max-classes-per-file -- the shared ItemReferenceBuilder base lives with
   its primary subclass. */
import { BuilderType } from '../../shared/taxonomy'
import { ReferenceBuilder } from './ReferenceBuilder'
import { splitKey } from './utils/splitKey'
import type { ReferenceExpr } from '../types/expressions.type'

/**
 * Shared behaviour for the item reference builders: navigation into the item
 * a collection or loop is currently iterating. Subclasses supply the base
 * reference path for their scope shape.
 */
export abstract class ItemReferenceBuilder {
  protected constructor(protected readonly level: number) {}

  /**
   * Build the whole-item reference expression, so a bare item reference in a
   * value position means the same as .value().
   * Called automatically by finaliseBuilders().
   */
  build(): ReferenceExpr {
    return this.value().build()
  }

  /**
   * Get a sub-property of the item.
   * Supports dot notation: .path('user.address.city')
   *
   * @example
   * Item().path('name')
   * Item().path('address.postcode')
   */
  path(key: string): ReferenceBuilder {
    return ReferenceBuilder.create([...this.itemPath(), ...splitKey(key)])
  }

  /**
   * Get the full value of the item.
   *
   * @example
   * Item().value()  // Returns the entire item object
   */
  value(): ReferenceBuilder {
    return ReferenceBuilder.create(this.itemPath())
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
    return ReferenceBuilder.create([...this.itemPath(), '@key'])
  }

  protected abstract itemPath(): string[]
}

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
 * // Navigate to the outer item in nested iterators
 * Item().parent.path('groupId')  // -> ['@scope', '1', 'groupId']
 *
 * @internal Exposed to authors via the ChainableScopedRef interface.
 */
export class ScopedReferenceBuilder extends ItemReferenceBuilder {
  readonly _forge = BuilderType.SCOPED_REFERENCE as const

  private constructor(level: number) {
    super(level)
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

  protected itemPath(): string[] {
    return ['@scope', this.level.toString()]
  }
}

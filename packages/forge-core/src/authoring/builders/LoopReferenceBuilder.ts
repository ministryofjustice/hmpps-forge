import { resolvesMarker } from '../types/expressions.type'
import { ReferenceBuilder } from './ReferenceBuilder'
import { LoopItemReferenceBuilder } from './LoopItemReferenceBuilder'

/**
 * Immutable builder for creating references to iterator loop metadata.
 *
 * This mirrors Nunjucks' loop object: Item() references the current item, while
 * Loop references metadata about the current iteration.
 *
 * @internal Exposed to authors via the ChainableLoopRef interface.
 */
export class LoopReferenceBuilder {
  // Type-only ChainableExpression brand - never set at runtime.
  declare readonly [resolvesMarker]: any

  readonly nodeKind = 'forge-builder' as const

  private readonly level: number

  private constructor(level: number) {
    this.level = level
  }

  /**
   * Create a loop reference builder at the specified nesting level.
   * Level 0 is the current loop, level 1 is the parent loop, etc.
   */
  static create(level: number): LoopReferenceBuilder {
    return new LoopReferenceBuilder(level)
  }

  /**
   * Navigate to the parent loop in nested collections.
   *
   * @example
   * Loop.Parent.Index()
   * Loop.Parent.Parent.Index0()
   */
  get Parent(): LoopReferenceBuilder {
    return new LoopReferenceBuilder(this.level + 1)
  }

  /**
   * Get a reference to the item this loop is currently iterating.
   *
   * @example
   * Loop.Item().path('name')  // Access item.name
   * Loop.Item().value()  // Access the whole item
   * Loop.Parent.Item().path('groupId')  // Access the parent loop's item
   */
  Item(): LoopItemReferenceBuilder {
    return LoopItemReferenceBuilder.create(this.level)
  }

  /**
   * Get the current iteration position (1-based).
   *
   * @example
   * Loop.Index()  // Returns 1, 2, 3, etc.
   */
  Index(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'index'])
  }

  /**
   * Get the current iteration index (0-based).
   *
   * @example
   * Loop.Index0()  // Returns 0, 1, 2, etc.
   */
  Index0(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'index0'])
  }

  /**
   * Get the reverse iteration position (1-based).
   *
   * @example
   * Loop.RevIndex()  // Returns length, length - 1, etc.
   */
  RevIndex(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'revindex'])
  }

  /**
   * Get the reverse iteration index (0-based).
   *
   * @example
   * Loop.RevIndex0()  // Returns length - 1, length - 2, etc.
   */
  RevIndex0(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'revindex0'])
  }

  /**
   * Check whether the current item is the first item in the iteration.
   *
   * @example
   * Loop.First()  // true for the first item
   */
  First(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'first'])
  }

  /**
   * Check whether the current item is the last item in the iteration.
   *
   * @example
   * Loop.Last()  // true for the last item
   */
  Last(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'last'])
  }

  /**
   * Get the number of items in the iteration.
   *
   * @example
   * Loop.Length()  // Returns the total item count
   */
  Length(): ReferenceBuilder {
    return ReferenceBuilder.create(['@loop', this.level.toString(), 'length'])
  }
}

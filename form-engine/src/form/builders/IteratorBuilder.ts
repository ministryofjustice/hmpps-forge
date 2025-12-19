import { MapIteratorConfig, FilterIteratorConfig, FindIteratorConfig, PredicateExpr } from '../types/expressions.type'
import { IteratorType } from '../types/enums'

/**
 * Iterator namespace containing factory functions for iterator configurations.
 *
 * Iterators are used with the .each() method to perform per-item operations on collections.
 * Unlike transformers which operate on the whole array, iterators enter per-item iteration
 * mode where Item() references are available.
 *
 * @example
 * // Map: Transform each item
 * Data('items').each(Iterator.Map(
 *   { label: Item().path('name'), value: Item().path('id') }
 * ))
 *
 * @example
 * // Filter: Keep matching items
 * Data('items').each(Iterator.Filter(
 *   Item().path('active').match(Condition.IsTrue())
 * ))
 *
 * @example
 * // Chain filter and map
 * Data('items')
 *   .each(Iterator.Filter(Item().path('active').match(Condition.IsTrue())))
 *   .each(Iterator.Map({ label: Item().path('name') }))
 */
export const Iterator = {
  /**
   * Create a Map iterator that transforms each item to a new shape.
   *
   * @param yieldValue - The template for each transformed item
   * @returns MapIteratorConfig to use with .each()
   *
   * @example
   * // Transform items to label/value pairs
   * Iterator.Map({ label: Item().path('name'), value: Item().path('id') })
   *
   * @example
   * // Extract a single property from each item
   * Iterator.Map(Item().path('name'))
   */
  Map(yieldValue: unknown): MapIteratorConfig {
    return {
      type: IteratorType.MAP,
      yield: yieldValue,
    }
  },

  /**
   * Create a Filter iterator that keeps items matching a predicate.
   *
   * @param predicate - Predicate expression using Item() references
   * @returns FilterIteratorConfig to use with .each()
   *
   * @example
   * // Keep only active items
   * Iterator.Filter(Item().path('active').match(Condition.IsTrue()))
   *
   * @example
   * // Exclude items matching a value
   * Iterator.Filter(Item().path('slug').not.match(Condition.Equals(Params('currentSlug'))))
   */
  Filter(predicate: PredicateExpr): FilterIteratorConfig {
    return {
      type: IteratorType.FILTER,
      predicate,
    }
  },

  /**
   * Create a Find iterator that returns the first item matching a predicate.
   * Returns undefined if no match is found.
   *
   * @param predicate - Predicate expression using Item() references
   * @returns FindIteratorConfig to use with .each()
   *
   * @example
   * // Find user by ID
   * Data('users').each(Iterator.Find(
   *   Item().path('id').match(Condition.Equals(Params('userId')))
   * ))
   *
   * @example
   * // Find first active item
   * Data('items').each(Iterator.Find(
   *   Item().path('active').match(Condition.IsTrue())
   * ))
   */
  Find(predicate: PredicateExpr): FindIteratorConfig {
    return {
      type: IteratorType.FIND,
      predicate,
    }
  },
}

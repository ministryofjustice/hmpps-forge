import { BuildableReference, createReference } from './createReference'
import { ExpressionType } from '../../types/enums'

/**
 * Builder interface for creating references within collection contexts.
 *
 * Provides methods to navigate hierarchical data structures and access
 * properties of items during collection iteration. This is primarily used
 * with the Item() reference to access data in collection blocks.
 *
 * @example
 * ```typescript
 *
 * // Access a property of the current item
 * Item().property('name')  // -> item.name
 *
 * // Access the full item value
 * Item().value()  // -> item
 *
 * // Access the current iteration index
 * Item().index()  // -> 0, 1, 2, ...
 *
 * // Navigate to parent in nested collections
 * Item().parent.property('groupId')  // -> parent item's groupId
 * Item().parent.parent.property('orgId')  // -> grandparent's orgId
 * ```
 */
export interface CreateScopedReference {
  /** Navigate to the parent of a collection item */
  parent: CreateScopedReference

  /** Get sub properties of a collection item */
  property(key: string): BuildableReference

  /** Get the value of the collection item */
  value(): BuildableReference

  /** Get the index of the collection item */
  index(): BuildableReference
}

/**
 * Creates a scope builder using Proxy for property-based navigation
 * //TODO: This could probably use re-working
 */
/**
 * Split a key string into path segments
 * 'user.name' → ['user', 'name']
 * 'simple' → ['simple']
 */
const splitKey = (key: string): string[] => (key.includes('.') ? key.split('.') : [key])

export function createScopedReference(currentLevel: number = 0): CreateScopedReference {
  const currentPath = ['@scope', currentLevel.toString()]

  const builder = {
    property(key: string): BuildableReference {
      return createReference({
        type: ExpressionType.REFERENCE,
        path: [...currentPath, ...splitKey(key)],
      })
    },

    value(): BuildableReference {
      return createReference({
        type: ExpressionType.REFERENCE,
        path: currentPath,
      })
    },

    index(): BuildableReference {
      return createReference({
        type: ExpressionType.REFERENCE,
        path: [...currentPath, '@index'],
      })
    },
  }

  // Use Proxy to handle property access for navigation
  return new Proxy(builder, {
    get(target, prop) {
      // Return existing methods
      if (prop in target) {
        // @ts-expect-error - //TODO: fix this correctly
        return target[prop]
      }

      // Handle navigation properties
      switch (prop) {
        case 'parent':
          // Move up one level in the scope hierarchy
          return createScopedReference(currentLevel + 1)

        default:
          throw new Error(`Unknown scope property: ${String(prop)}`)
      }
    },

    has(target, prop) {
      const navigationProps = ['parent']
      return prop in target || navigationProps.includes(prop as string)
    },

    ownKeys(target) {
      return Reflect.ownKeys(target)
    },

    getOwnPropertyDescriptor(target, prop) {
      const navigationProps = ['parent']
      if (navigationProps.includes(prop as string)) {
        return undefined
      }
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
  }) as CreateScopedReference
}

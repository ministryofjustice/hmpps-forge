import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Deep clone a value with special handling for AST nodes
 *
 * AST nodes are cloned without their `id` property, allowing them to be
 * re-registered with new identities. This is useful for normalizers that
 * duplicate or template AST structures.
 *
 * @param value - The value to clone
 * @returns A deep clone of the value
 */
export function cloneASTValue<T>(value: T): T {
  // Primitives and null/undefined are immutable, return as-is
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  // Recursively clone arrays
  if (Array.isArray(value)) {
    return value.map(item => cloneASTValue(item)) as unknown as T
  }

  // AST nodes: clone all properties except `id`
  if (isASTNode(value)) {
    const cloned: any = {}

    Object.entries(value).forEach(([key, val]) => {
      // Skip id field - it will be reassigned during registration
      if (key === 'id') {
        return
      }

      // Recursively clone all other properties
      cloned[key] = cloneASTValue(val)
    })

    return cloned
  }

  // Clone Maps with recursive value cloning
  if (value instanceof Map) {
    const clonedMap = new Map<any, any>()

    value.forEach((mapValue, key) => {
      clonedMap.set(key, cloneASTValue(mapValue))
    })

    return clonedMap as unknown as T
  }

  // Clone plain objects
  const cloned: Record<string, unknown> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
    cloned[key] = cloneASTValue(val)
  })

  return cloned as unknown as T
}

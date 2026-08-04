import { isASTNode } from '../../../contracts/ast/nodes'

/**
 * Deep clone a value with special handling for AST nodes.
 *
 * AST nodes are cloned without their `id` property so callers can assign
 * fresh identities before registration.
 */
export function cloneASTValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneASTValue(item)) as unknown as T
  }

  if (isASTNode(value)) {
    const cloned: Record<string, unknown> = {}

    Object.entries(value).forEach(([key, entryValue]) => {
      if (key === 'id') {
        return
      }

      cloned[key] = cloneASTValue(entryValue)
    })

    return cloned as T
  }

  if (value instanceof Map) {
    const clonedMap = new Map<unknown, unknown>()

    value.forEach((mapValue, key) => {
      clonedMap.set(key, cloneASTValue(mapValue))
    })

    return clonedMap as unknown as T
  }

  const cloned: Record<string, unknown> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
    cloned[key] = cloneASTValue(entryValue)
  })

  return cloned as T
}

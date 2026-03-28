import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { isASTNode, isTemplateNode } from '@form-engine/core/typeguards/nodes'

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

/**
 * Recursively assign IDs to AST nodes in a cloned value tree.
 */
export function assignIdsToClonedValue(
  value: unknown,
  nodeIdGenerator: NodeIDGenerator,
  category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => assignIdsToClonedValue(item, nodeIdGenerator, category))

    return
  }

  if (isTemplateNode(value)) {
    return
  }

  if (isASTNode(value) && !value.id) {
    ;(value as { id?: string }).id = nodeIdGenerator.next(category)
  }

  Object.values(value).forEach(entryValue => {
    assignIdsToClonedValue(entryValue, nodeIdGenerator, category)
  })
}

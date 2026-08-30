import ForgeAuthoringError from '../../../engine/errors/ForgeAuthoringError'
import DSLSourceLocator from '../../../shared/diagnostics/DSLSourceLocator'
import type { DSLPathSegment } from '../../../shared/diagnostics/sourceLocation.type'
import { stampCallsite } from './captureCallsite'

const carryCallsite = (from: object, to: unknown): void => {
  const callsite = Object.getOwnPropertyDescriptor(from, '__callsite')?.value

  if (callsite) {
    stampCallsite(to, callsite)
  }
}

interface Buildable {
  build(): unknown
}

const isBuildable = (value: unknown): value is Buildable => {
  return value !== null &&
    typeof value === 'object' &&
    (value as any).nodeKind === 'forge-builder' &&
    'build' in value &&
    typeof (value as any).build === 'function'
}

const describePath = (path: readonly DSLPathSegment[]): string => (path.length === 0 ? '<root>' : path.join('.'))

const finalise = (value: unknown, path: DSLPathSegment[], ancestors: Set<object>): unknown => {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (ancestors.has(value)) {
    throw new ForgeAuthoringError({
      message:
        `Circular reference detected in form configuration at "${describePath(path)}". ` +
        'Configuration objects must form a tree; an object cannot contain itself.',
    })
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => finalise(item, [...path, index], ancestors))
    }

    if (isBuildable(value)) {
      // Recurse into the built output at the same path so shared builder
      // instances produce a fresh copy per tree position.
      const built = value.build()
      carryCallsite(value, built)
      return finalise(built, path, ancestors)
    }

    const prototype = Object.getPrototypeOf(value)

    if (prototype !== Object.prototype && prototype !== null) {
      return value
    }

    const result: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = finalise(entry, [...path, key], ancestors)
    })
    carryCallsite(value, result)
    return result
  } finally {
    ancestors.delete(value)
  }
}

const stampSource = (node: unknown, path: DSLPathSegment[], locator: DSLSourceLocator): void => {
  if (node === null || typeof node !== 'object') {
    return
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => stampSource(item, [...path, index], locator))
    return
  }

  // configurable + writable so an outer finaliseBuilders() walk can re-stamp
  // nodes that were already stamped by an earlier, narrower walk.
  Object.defineProperty(node, '__source', {
    value: locator.fromPath(path),
    enumerable: false,
    configurable: true,
    writable: true,
  })

  Object.entries(node).forEach(([key, entry]) => {
    stampSource(entry, [...path, key], locator)
  })
}

/**
 * Convert form configuration from builders into JSON.
 * Recursively processes objects and arrays, calling build() on any Buildable instances.
 *
 * Every object node in the output is stamped with a non-enumerable `__source`
 * ({ path, formattedPath }) describing its position in the finalised tree.
 * Stamping happens in a second pass over the fully finalised tree so that
 * formatted paths resolve context (step codes, block variants) against final
 * values rather than un-built builders.
 *
 * Shared builder instances are finalised once per tree position: each position
 * gets its own built copy so per-position `__source` stamps are possible.
 * Circular references in the input throw.
 *
 * @param input - Objects, arrays that contain builders
 */
export const finaliseBuilders = <T>(input: T): unknown => {
  const result = finalise(input, [], new Set())
  stampSource(result, [], new DSLSourceLocator(result))
  return result
}

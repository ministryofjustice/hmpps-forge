import DSLPathFormatter from './DSLPathFormatter'
import type { DSLPathSegment, DSLSourceLocation } from './sourceLocation.type'

const isValidCallsite = (value: unknown): value is { readonly stack?: string } =>
  typeof value === 'object' &&
  value !== null &&
  (!('stack' in value) || typeof (value as { stack?: unknown }).stack === 'string')

export default class DSLSourceLocator {
  constructor(
    private readonly root: unknown,
    private readonly pathFormatter = new DSLPathFormatter(),
  ) {}

  fromPath(path: readonly DSLPathSegment[]): DSLSourceLocation {
    return {
      path,
      formattedPath: this.pathFormatter.format(this.root, path),
    }
  }

  /**
   * Resolves the captured author callsite for the node at the given path by
   * reading the nearest `__callsite` stamp, walking from the node itself up
   * through its ancestors to the root.
   */
  callsiteFromPath(path: readonly DSLPathSegment[]): { readonly stack?: string } | undefined {
    const objects: object[] = []
    let current: unknown = this.root

    for (let i = 0; i < path.length && current !== null && typeof current === 'object'; i += 1) {
      objects.push(current)
      current = (current as Record<DSLPathSegment, unknown>)[path[i]]
    }

    if (current !== null && typeof current === 'object') {
      objects.push(current)
    }

    for (let i = objects.length - 1; i >= 0; i -= 1) {
      const callsite = Object.getOwnPropertyDescriptor(objects[i], '__callsite')?.value

      if (isValidCallsite(callsite)) {
        return callsite
      }
    }

    return undefined
  }
}

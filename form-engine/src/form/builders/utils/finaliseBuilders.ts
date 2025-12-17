interface Buildable {
  build(): unknown
}

const isBuildable = (value: unknown): value is Buildable => {
  return value !== null && typeof value === 'object' && 'build' in value && typeof (value as any).build === 'function'
}

/**
 * Convert form configuration from builders into JSON.
 * Recursively processes objects and arrays, calling build() on any Buildable instances.
 *
 * @param input - Objects, arrays that contain builders
 */
export const finaliseBuilders = <T>(input: T, visited: WeakSet<object> = new WeakSet()): unknown => {
  if (input === null || typeof input !== 'object') {
    return input
  }

  // Prevent infinite recursion from circular references
  if (visited.has(input)) {
    return input
  }

  visited.add(input)

  if (Array.isArray(input)) {
    return input.map(item => finaliseBuilders(item, visited))
  }

  if (isBuildable(input)) {
    // Recursively finalise in case build() returns more builders
    return finaliseBuilders(input.build(), visited)
  }

  const result: Record<string, unknown> = {}

  Object.entries(input).forEach(([key, value]) => {
    result[key] = finaliseBuilders(value, visited)
  })

  return result
}

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
 * Uses a WeakMap cache so that shared builder instances (e.g. a Data() reference stored
 * as a module-level constant) are built once and the result is reused, rather than
 * returning the raw builder on subsequent encounters.
 *
 * @param input - Objects, arrays that contain builders
 * @param cache - WeakMap tracking already-processed objects to handle circular references and shared instances
 */
export const finaliseBuilders = <T>(input: T, cache: WeakMap<object, unknown> = new WeakMap()): unknown => {
  if (input === null || typeof input !== 'object') {
    return input
  }

  // Return cached result for previously seen objects (handles circular references
  // and shared builder instances)
  if (cache.has(input)) {
    return cache.get(input)
  }

  if (Array.isArray(input)) {
    const result: unknown[] = []
    cache.set(input, result)
    input.forEach(item => result.push(finaliseBuilders(item, cache)))
    return result
  }

  if (isBuildable(input)) {
    // Build first, then cache before recursing to prevent infinite loops
    // if the build output contains a reference back to this builder.
    //
    // Known limitation: if a builder's build() output circularly references the builder
    // itself, the circular encounter will receive the un-finalised build output. This
    // cannot happen in the form engine because builders (e.g. Data(), Format(), field())
    // always produce plain JSON — they never reference the builder that created them.
    const built = input.build();
    cache.set(input, built)
    const result = finaliseBuilders(built, cache)
    cache.set(input, result)
    return result
  }

  const result: Record<string, unknown> = {}
  cache.set(input, result)

  Object.entries(input).forEach(([key, value]) => {
    result[key] = finaliseBuilders(value, cache)
  })

  return result
}

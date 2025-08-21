interface Buildable {
  build(): unknown
}

const isBuildable = (value: unknown): value is Buildable => {
  return value !== null && typeof value === 'object' && 'build' in value && typeof (value as any).build === 'function'
}

/**
 * Convert form configuration from builders into JSON
 * @param input - Objects, arrays that contain builders
 */
export const finaliseBuilders = <T>(input: T): unknown => {
  if (input === null || typeof input !== 'object') {
    return input
  }

  if (Array.isArray(input)) {
    return input.map(finaliseBuilders)
  }

  if (isBuildable(input)) {
    return input.build()
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    result[key] = finaliseBuilders(value)
  }
  return result
}

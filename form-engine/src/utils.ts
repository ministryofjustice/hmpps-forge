/**
 * Gets a value from an object using a dot-notation path
 * @param obj - The object to extract from
 * @param path - The dot-notation path (e.g., 'user.profile.name')
 */
export function getByPath(obj: any, path: string): string | undefined {
  if (!obj || typeof path !== 'string') {
    return undefined
  }

  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    current = current[key]
  }

  if (current == null) {
    return undefined
  }

  return current
}

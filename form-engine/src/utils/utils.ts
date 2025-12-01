/**
 * Gets a value from an object using a dot-notation path
 * @param obj - The object to extract from
 * @param path - The dot-notation path (e.g., 'user.profile.name')
 */
export function getByPath<T = unknown>(obj: unknown, path: string): T | undefined {
  if (obj == null || typeof path !== 'string') {
    return undefined
  }

  if (path === '') {
    return obj as T
  }

  const keys = path.split('.')
  let current: any = obj

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    current = current[key]
  }

  return current as T
}

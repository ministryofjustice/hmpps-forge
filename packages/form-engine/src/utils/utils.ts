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

type Field = { label: string; value?: unknown }

/** Format an array of label/value fields as a single-line string: `label=value, label=value` */
export default function formatFields(fields: Field[]): string {
  return fields
    .filter(f => f.value !== undefined && f.value !== null && String(f.value) !== '')
    .map(f => `${f.label}=${Array.isArray(f.value) ? f.value.join(', ') : f.value}`)
    .join(', ')
}

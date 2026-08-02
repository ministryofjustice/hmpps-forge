/**
 * Split a key string into path segments.
 * 'user.name' -> ['user', 'name']
 * 'simple' -> ['simple']
 */
export const splitKey = (key: string): string[] => (key.includes('.') ? key.split('.') : [key])

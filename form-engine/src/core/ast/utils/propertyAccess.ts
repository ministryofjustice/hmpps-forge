/**
 * Utility functions for safe property access during thunk evaluation
 *
 * Provides protection against prototype pollution attacks by validating
 * property keys before access.
 */

/**
 * Dangerous property names that could be used for prototype pollution
 */
const DANGEROUS_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Check if a property key is safe to use (not a dangerous property)
 *
 * @param key - The property key to validate
 * @returns true if the key is safe, false if it's dangerous
 *
 * @example
 * ```typescript
 * if (isSafePropertyKey('email')) {
 *   obj[key] = value  // Safe to write
 * }
 * ```
 */
export function isSafePropertyKey(key: string | number): boolean {
  const keyStr = String(key)

  return !DANGEROUS_PROPERTIES.has(keyStr)
}

/**
 * Safely access a property on an object, returning undefined if the property
 * is dangerous or if the object is not an object
 *
 * Protects against prototype pollution by blocking access to dangerous
 * properties like __proto__, constructor, and prototype.
 *
 * @param obj - The object to access
 * @param key - The property key to access
 * @returns The property value, or undefined if access is unsafe
 *
 * @example
 * ```typescript
 * const value = safePropertyAccess(data, 'email')
 * // Returns undefined for dangerous keys like '__proto__'
 * ```
 */
export function safePropertyAccess(obj: unknown, key: string | number): unknown {
  if (obj === undefined || obj === null) {
    return undefined
  }

  if (typeof obj !== 'object') {
    return undefined
  }

  const keyStr = String(key)

  if (DANGEROUS_PROPERTIES.has(keyStr)) {
    return undefined
  }

  return (obj as Record<string | number, unknown>)[key]
}

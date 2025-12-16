/**
 * HTML entity encoding map for XSS prevention
 */
const HTML_ENTITY_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escape HTML entities in a string value to prevent XSS attacks.
 *
 * Converts dangerous characters to their HTML entity equivalents:
 * - < becomes &lt;
 * - > becomes &gt;
 * - & becomes &amp;
 * - " becomes &quot;
 * - ' becomes &#39;
 *
 * @param value - The string value to sanitize
 * @returns The sanitized string with HTML entities escaped
 */
export function escapeHtmlEntities(value: string): string {
  return value.replace(/[<>&"']/g, char => HTML_ENTITY_MAP[char])
}

/**
 * Sanitize a value if it is a string, otherwise return unchanged.
 *
 * Only string values are sanitized. Arrays, numbers, booleans, null,
 * undefined, and objects are returned as-is.
 *
 * @param value - The value to potentially sanitize
 * @returns The sanitized value (if string) or original value
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  return escapeHtmlEntities(value)
}

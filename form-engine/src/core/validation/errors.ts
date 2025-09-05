/**
 * Structured validation error
 */
export interface ValidationError {
  /** Path to the invalid field */
  path: (string | number)[]
  /** Human-readable error message */
  message: string
  /** Expected value type/format */
  expected?: string
  /** Error code for programmatic handling */
  code?: string
}

/**
 * Create a validation error for non-serializable types
 */
export function createNonSerializableError(type: string, path: (string | number)[]): ValidationError {
  return {
    path,
    message: `${type} at ${path.length ? path.join('.') : 'root'} (not JSON serializable)`,
    code: 'non_serializable',
  }
}

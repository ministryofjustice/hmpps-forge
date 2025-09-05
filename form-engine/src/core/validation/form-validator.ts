import { JourneySchema } from './schemas/structures.schema'
import { ValidationError, createMaxDepthError, createNonSerializableError } from './errors'

/** Result of validation */
export interface ValidationResult {
  /** Whether the input is valid according to the schema */
  isValid: boolean

  /** Validation errors if invalid */
  errors: ValidationError[]
}

/** Options for validation */
export interface ValidationOptions {
  /** Maximum allowed nesting depth */
  maxDepth?: number
}

/**
 * Form configuration validator that checks JSON and schema validity
 */
export class FormValidator {
  private readonly options: Required<ValidationOptions>

  constructor(options: ValidationOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 100,
    }
  }

  /**
   * Validate a journey definition
   */
  validateSchema(input: unknown) {
    const errors: ValidationError[] = []

    if (this.exceedsMaxDepth(input, this.options.maxDepth)) {
      errors.push(createMaxDepthError(this.options.maxDepth, []))

      return { isValid: false, errors }
    }

    const result = JourneySchema.safeParse(input)

    return {
      isValid: result.success,
      errors: result.error?.issues || [],
    }
  }

  /**
   * Check if an object exceeds maximum nesting depth
   */
  private exceedsMaxDepth(obj: any, maxDepth: number, currentDepth = 0): boolean {
    if (currentDepth > maxDepth) return true

    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        return obj.some(item => this.exceedsMaxDepth(item, maxDepth, currentDepth + 1))
      }

      return Object.values(obj).some(value => this.exceedsMaxDepth(value, maxDepth, currentDepth + 1))
    }

    return false
  }

  /**
   * Validate that input is valid JSON
   */
  validateJSON(input: unknown): ValidationResult {
    const errors: ValidationError[] = []

    if (input === undefined) {
      errors.push({
        path: [],
        message: 'Input is undefined (not valid JSON)',
        code: 'non_serializable',
      })
      return { isValid: false, errors }
    }

    const typeErrors = this.checkSerializableTypes(input, [])
    errors.push(...typeErrors)

    if (errors.length === 0) {
      try {
        const serialized = JSON.stringify(input)
        JSON.parse(serialized)
      } catch (error) {
        errors.push({
          path: [],
          message: `JSON serialization failed: ${(error as Error).message}`,
          code: 'json_error',
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Check for non-serializable types
   */
  private checkSerializableTypes(obj: any, path: string[] = [], seen = new WeakSet()): ValidationError[] {
    const errors: ValidationError[] = []

    if (obj === undefined) {
      errors.push(createNonSerializableError('Undefined value', path))
    } else if (typeof obj === 'function') {
      errors.push(createNonSerializableError('Function', path))
    } else if (typeof obj === 'symbol') {
      errors.push(createNonSerializableError('Symbol', path))
    } else if (typeof obj === 'bigint') {
      errors.push(createNonSerializableError('BigInt', path))
    } else if (obj instanceof Date) {
      errors.push(createNonSerializableError('Date object', path))
    } else if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        return errors
      }

      seen.add(obj)

      if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
          errors.push(...this.checkSerializableTypes(item, [...path, String(i)], seen))
        })
      } else if (obj.constructor !== Object) {
        errors.push(createNonSerializableError(`Non-plain object (${obj.constructor.name})`, path))
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          errors.push(...this.checkSerializableTypes(value, [...path, key], seen))
        })
      }
    }

    return errors
  }
}

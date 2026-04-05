import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { FunctionType } from '../../authoring/types/enums'
import type FunctionRegistry from '../FunctionRegistry'
import FormConfigurationSerialisationError from '../errors/FormConfigurationSerialisationError'
import FormConfigurationSchemaError from '../errors/FormConfigurationSchemaError'
import UnregisteredFunctionError from '../errors/UnregisteredFunctionError'
import { JourneySchema } from './schemas/structures.schema'

const FUNCTION_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(FunctionType))

/**
 * Form configuration validator that checks JSON and schema validity
 */
export class DSLValidator {
  /**
   * Validate schema
   */
  static validateSchema(input: JourneyDefinition): void {
    const result = JourneySchema.safeParse(input)

    if (!result.success) {
      const schemaErrors = result.error.issues.map(issue => {
        return new FormConfigurationSchemaError({
          path: issue.path as (string | number)[],
          message: issue.message,
          expected: 'expected' in issue ? (issue as any).expected : undefined,
          code: issue.code,
        })
      })

      throw new AggregateError(schemaErrors, 'Schema validation failed')
    }
  }

  /**
   * Validate that input is valid JSON
   * //TODO: This is probably poorly named, as it doesnt actually validate pure JSON, it validates
   *    that an object CAN be serialised into JSON without any issue.
   */
  static validateJSON(input: unknown): void {
    if (input === undefined) {
      throw new FormConfigurationSerialisationError({
        path: [],
        message: 'Input is undefined (not valid JSON)',
        type: 'non_serializable',
      })
    }

    const errors = this.checkSerializableTypes(input, [])

    if (errors.length > 0) {
      throw new AggregateError(errors, 'JSON validation failed due to non-serializable types')
    }

    try {
      const serialized = JSON.stringify(input)
      JSON.parse(serialized)
    } catch (error) {
      throw new FormConfigurationSerialisationError({
        path: [],
        message: `JSON serialization failed: ${(error as Error).message}`,
        type: 'json_error',
      })
    }
  }

  /**
   * Validate that all functions referenced in the journey configuration are registered
   */
  static validateFunctions(input: JourneyDefinition, functionRegistry: FunctionRegistry): void {
    const errors: UnregisteredFunctionError[] = []

    this.walkForFunctionReferences(input, [], (path, name, type) => {
      if (!functionRegistry.has(name)) {
        errors.push(new UnregisteredFunctionError({ path, functionName: name, functionType: type }))
      }
    })

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        'Function validation failed: unregistered functions found in journey configuration',
      )
    }
  }

  /**
   * Recursively walk an object tree, invoking the callback for each function reference found
   */
  private static walkForFunctionReferences(
    obj: unknown,
    path: (string | number)[],
    onFunction: (path: (string | number)[], name: string, type: string) => void,
  ): void {
    if (!obj || typeof obj !== 'object') {
      return
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => this.walkForFunctionReferences(item, [...path, i], onFunction))

      return
    }

    const record = obj as Record<string, unknown>

    if (typeof record.type === 'string' && FUNCTION_TYPE_VALUES.has(record.type) && typeof record.name === 'string') {
      onFunction(path, record.name, record.type)
    }

    Object.entries(record).forEach(([key, value]) => {
      this.walkForFunctionReferences(value, [...path, key], onFunction)
    })
  }

  /**
   * Check for non-serializable types
   */
  private static checkSerializableTypes(
    obj: any,
    path: string[] = [],
    seen = new WeakSet(),
  ): FormConfigurationSerialisationError[] {
    const errors: FormConfigurationSerialisationError[] = []

    if (obj === undefined) {
      errors.push(new FormConfigurationSerialisationError({ type: 'Undefined value', path }))
    } else if (typeof obj === 'function') {
      errors.push(new FormConfigurationSerialisationError({ type: 'Function', path }))
    } else if (typeof obj === 'symbol') {
      errors.push(new FormConfigurationSerialisationError({ type: 'Symbol', path }))
    } else if (typeof obj === 'bigint') {
      errors.push(new FormConfigurationSerialisationError({ type: 'BigInt', path }))
    } else if (obj instanceof Date) {
      errors.push(new FormConfigurationSerialisationError({ type: 'Date object', path }))
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
        errors.push(
          new FormConfigurationSerialisationError({ type: `Non-plain object (${obj.constructor.name})`, path }),
        )
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          errors.push(...this.checkSerializableTypes(value, [...path, key], seen))
        })
      }
    }

    return errors
  }
}

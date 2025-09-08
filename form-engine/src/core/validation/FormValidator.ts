import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import FormConfigurationSerialisationError from '@form-engine/errors/FormConfigurationSerialisationError'
import FormConfigurationSchemaError from '@form-engine/errors/FormConfigurationSchemaError'
import { JourneySchema } from './schemas/structures.schema'

/**
 * Form configuration validator that checks JSON and schema validity
 */
export class FormValidator {
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
      throw new AggregateError(errors, 'JSON validation failed')
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

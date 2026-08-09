import type { JourneyDefinition } from '../../../authoring/types/structures.type'
import ForgeSerialisationError from '../../errors/ForgeSerialisationError'
import ForgeSchemaError from '../../errors/ForgeSchemaError'
import { JourneySchema } from './schemas/structures.schema'
import DSLSourceLocator from '../../../shared/diagnostics/DSLSourceLocator'
import type { DSLPathSegment } from '../../../shared/diagnostics/sourceLocation.type'

export class DSLValidator {
  static validateSchema(input: unknown): asserts input is JourneyDefinition {
    const result = JourneySchema.safeParse(input)

    if (!result.success) {
      const sourceLocator = new DSLSourceLocator(input)
      const schemaErrors = result.error.issues.map(issue => {
        const path = issue.path.map(pathPart => (typeof pathPart === 'symbol' ? pathPart.toString() : pathPart))

        return new ForgeSchemaError({
          message: issue.message,
          formattedPath: sourceLocator.fromPath(path).formattedPath,
          expected: 'expected' in issue && typeof issue.expected === 'string' ? issue.expected : undefined,
          callsite: sourceLocator.callsiteFromPath(path),
        })
      })

      throw new AggregateError(schemaErrors, 'Schema validation failed')
    }
  }

  /**
   * //TODO: This is probably poorly named, as it doesnt actually validate pure JSON, it validates
   *    that an object CAN be serialised into JSON without any issue.
   */
  static validateJSON(input: unknown): void {
    if (input === undefined) {
      throw new ForgeSerialisationError({
        message: 'Input is undefined (not valid JSON)',
        formattedPath: 'root',
        type: 'non_serializable',
      })
    }

    const sourceLocator = new DSLSourceLocator(input)
    const errors = this.checkSerializableTypes(input, [], sourceLocator)

    if (errors.length > 0) {
      throw new AggregateError(errors, 'JSON validation failed due to non-serializable types')
    }

    try {
      const serialized = JSON.stringify(input)
      JSON.parse(serialized)
    } catch (error) {
      throw new ForgeSerialisationError({
        message: `JSON serialization failed: ${(error as Error).message}`,
        formattedPath: sourceLocator.fromPath([]).formattedPath,
        type: 'json_error',
        callsite: sourceLocator.callsiteFromPath([]),
      })
    }
  }

  private static checkSerializableTypes(
    obj: unknown,
    path: DSLPathSegment[] = [],
    sourceLocator: DSLSourceLocator = new DSLSourceLocator(obj),
    seen = new WeakSet(),
  ): ForgeSerialisationError[] {
    const errors: ForgeSerialisationError[] = []

    if (obj === undefined) {
      errors.push(
        new ForgeSerialisationError({
          type: 'Undefined value',
          formattedPath: sourceLocator.fromPath(path).formattedPath,
          callsite: sourceLocator.callsiteFromPath(path),
        }),
      )
    } else if (typeof obj === 'function') {
      errors.push(
        new ForgeSerialisationError({
          type: 'Function',
          formattedPath: sourceLocator.fromPath(path).formattedPath,
          callsite: sourceLocator.callsiteFromPath(path),
        }),
      )
    } else if (typeof obj === 'symbol') {
      errors.push(
        new ForgeSerialisationError({
          type: 'Symbol',
          formattedPath: sourceLocator.fromPath(path).formattedPath,
          callsite: sourceLocator.callsiteFromPath(path),
        }),
      )
    } else if (typeof obj === 'bigint') {
      errors.push(
        new ForgeSerialisationError({
          type: 'BigInt',
          formattedPath: sourceLocator.fromPath(path).formattedPath,
          callsite: sourceLocator.callsiteFromPath(path),
        }),
      )
    } else if (obj instanceof Date) {
      errors.push(
        new ForgeSerialisationError({
          type: 'Date object',
          formattedPath: sourceLocator.fromPath(path).formattedPath,
          callsite: sourceLocator.callsiteFromPath(path),
        }),
      )
    } else if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        return errors
      }

      seen.add(obj)

      if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
          errors.push(...this.checkSerializableTypes(item, [...path, i], sourceLocator, seen))
        })
      } else if (Object.getPrototypeOf(obj) !== Object.prototype) {
        const constructorName =
          typeof obj.constructor === 'function' && obj.constructor.name ? obj.constructor.name : 'unknown'

        errors.push(
          new ForgeSerialisationError({
            type: `Non-plain object (${constructorName})`,
            formattedPath: sourceLocator.fromPath(path).formattedPath,
          }),
        )
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          errors.push(...this.checkSerializableTypes(value, [...path, key], sourceLocator, seen))
        })
      }
    }

    return errors
  }
}

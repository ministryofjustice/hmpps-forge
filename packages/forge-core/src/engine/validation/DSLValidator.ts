import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type FunctionRegistry from '../registries/FunctionRegistry'
import type ComponentRegistry from '../registries/ComponentRegistry'
import ForgeConfigurationSerialisationError from '../errors/ForgeConfigurationSerialisationError'
import ForgeConfigurationSchemaError from '../errors/ForgeConfigurationSchemaError'
import { JourneySchema } from './schemas/structures.schema'
import { formatDSLPath } from '../diagnostics/formatDSLPath'
import { walkAndValidate } from './walkAndValidate'
import { referenceScopeRule } from './rules/validateReferenceScopes'
import { createFunctionRegistrationRule } from './rules/validateRegisteredFunctions'
import { createComponentRegistrationRule } from './rules/validateRegisteredComponents'
import { effectScopeRule } from './rules/validateEffectScope'
import type { ValidationRule } from './rules/types'

export class DSLValidator {
  static validateSchema(input: unknown): asserts input is JourneyDefinition {
    const result = JourneySchema.safeParse(input)

    if (!result.success) {
      const schemaErrors = result.error.issues.map(issue => {
        const path = issue.path.map(pathPart => (typeof pathPart === 'symbol' ? pathPart.toString() : pathPart))

        return new ForgeConfigurationSchemaError({
          path,
          message: issue.message,
          formattedPath: formatDSLPath(input, path),
          expected: 'expected' in issue && typeof issue.expected === 'string' ? issue.expected : undefined,
          code: issue.code,
        })
      })

      throw new AggregateError(schemaErrors, 'Schema validation failed')
    }
  }

  static validateTree(
    input: JourneyDefinition,
    functionRegistry: FunctionRegistry,
    componentRegistry: ComponentRegistry,
  ): void {
    const rules: readonly ValidationRule[] = [
      referenceScopeRule,
      effectScopeRule,
      createFunctionRegistrationRule(functionRegistry),
      createComponentRegistrationRule(componentRegistry),
    ]

    const errors = walkAndValidate(input, rules)

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Tree validation failed')
    }
  }

  /**
   * //TODO: This is probably poorly named, as it doesnt actually validate pure JSON, it validates
   *    that an object CAN be serialised into JSON without any issue.
   */
  static validateJSON(input: unknown): void {
    if (input === undefined) {
      throw new ForgeConfigurationSerialisationError({
        path: [],
        message: 'Input is undefined (not valid JSON)',
        formattedPath: 'root',
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
      throw new ForgeConfigurationSerialisationError({
        path: [],
        message: `JSON serialization failed: ${(error as Error).message}`,
        formattedPath: formatDSLPath(input, []),
        type: 'json_error',
      })
    }
  }

  private static checkSerializableTypes(
    obj: unknown,
    path: (string | number)[] = [],
    root: unknown = obj,
    seen = new WeakSet(),
  ): ForgeConfigurationSerialisationError[] {
    const errors: ForgeConfigurationSerialisationError[] = []

    if (obj === undefined) {
      errors.push(
        new ForgeConfigurationSerialisationError({
          type: 'Undefined value',
          path,
          formattedPath: formatDSLPath(root, path),
        }),
      )
    } else if (typeof obj === 'function') {
      errors.push(
        new ForgeConfigurationSerialisationError({ type: 'Function', path, formattedPath: formatDSLPath(root, path) }),
      )
    } else if (typeof obj === 'symbol') {
      errors.push(
        new ForgeConfigurationSerialisationError({ type: 'Symbol', path, formattedPath: formatDSLPath(root, path) }),
      )
    } else if (typeof obj === 'bigint') {
      errors.push(
        new ForgeConfigurationSerialisationError({ type: 'BigInt', path, formattedPath: formatDSLPath(root, path) }),
      )
    } else if (obj instanceof Date) {
      errors.push(
        new ForgeConfigurationSerialisationError({
          type: 'Date object',
          path,
          formattedPath: formatDSLPath(root, path),
        }),
      )
    } else if (obj && typeof obj === 'object') {
      if (seen.has(obj)) {
        return errors
      }

      seen.add(obj)

      if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
          errors.push(...this.checkSerializableTypes(item, [...path, i], root, seen))
        })
      } else if (Object.getPrototypeOf(obj) !== Object.prototype) {
        const constructorName =
          typeof obj.constructor === 'function' && obj.constructor.name ? obj.constructor.name : 'unknown'

        errors.push(
          new ForgeConfigurationSerialisationError({
            type: `Non-plain object (${constructorName})`,
            path,
            formattedPath: formatDSLPath(root, path),
          }),
        )
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          errors.push(...this.checkSerializableTypes(value, [...path, key], root, seen))
        })
      }
    }

    return errors
  }
}

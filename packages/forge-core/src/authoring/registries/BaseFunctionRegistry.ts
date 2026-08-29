import { z, type ZodType } from 'zod'
import { FunctionCallType, FunctionEntryType } from '../../shared/taxonomy'
import ForgeAuthoringError from '../../engine/errors/ForgeAuthoringError'
import ForgeRegistryDuplicateError from '../../engine/errors/ForgeRegistryDuplicateError'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import { captureCallsite, stampCallsite } from '../builders/utils/captureCallsite'
import type { FunctionDefinitionObject, FunctionRegistryBuilder, FunctionRegistryObject } from '../types/functions.type'
import ForgeFunctionEntryBuildError from '../../engine/errors/ForgeFunctionEntryBuildError'

export interface RegistrationOptions {
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  prepare?: (...args: any[]) => any[]
}

interface RegistrationWithFactory<TDeps = any> extends RegistrationOptions {
  factory: (deps: TDeps) => (...args: any[]) => any
}

interface StoredRegistration {
  name: string
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  prepare?: (...args: any[]) => any[]
  factory: (deps: any) => (...args: any[]) => any
}

export const CONDITION_OUTPUT_SCHEMA = z.boolean()

const ENTRY_TAGS: Record<FunctionCallType, FunctionEntryType> = {
  [FunctionCallType.CONDITION]: FunctionEntryType.CONDITION,
  [FunctionCallType.TRANSFORMER]: FunctionEntryType.TRANSFORMER,
  [FunctionCallType.GENERATOR]: FunctionEntryType.GENERATOR,
  [FunctionCallType.EFFECT]: FunctionEntryType.EFFECT,
}

/**
 * @deprecated Use `condition()`, `transformer()`, `generator()`, or `effect()` to define each
 * function as a standalone entry instead of adding it to a registry.
 *
 * ```typescript
 * const SaveCase = effect<Dependencies>('SaveCase', {
 *   factory: dependencies => async context => dependencies.api.save(context.getAllAnswers()),
 * })
 *
 * submit({ validate: true, onValid: { effects: [SaveCase()] } })
 * ```
 *
 * You don't need a function registry anymore. Just define the function and use it in your journey;
 * Forge will pick it up. If your journey is JSON and refers to the function only by name, add it
 * with `functions: [SaveCase]`.
 */
export abstract class BaseFunctionRegistry<TDeps = Record<string, never>> implements FunctionRegistryBuilder<TDeps> {
  private readonly registrations = new Map<string, StoredRegistration>()

  private anonymousCounter = 0

  constructor(
    private readonly functionType: FunctionCallType,
    private readonly defaultOutputSchema?: ZodType,
  ) {}

  protected nextAnonymousName(): string {
    return `__anon_${this.anonymousCounter++}`
  }

  protected parseArgs(
    first: string | RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    second?: RegistrationOptions | ((deps: TDeps) => (...args: any[]) => any),
    third?: (deps: TDeps) => (...args: any[]) => any,
  ): { name: string; options: RegistrationOptions; factory: (deps: TDeps) => (...args: any[]) => any } {
    if (typeof first === 'function') {
      return { name: first.name || this.nextAnonymousName(), options: {}, factory: first }
    }

    if (typeof first !== 'string') {
      const factory = second as (deps: TDeps) => (...args: any[]) => any

      return { name: factory.name || this.nextAnonymousName(), options: first, factory }
    }

    if (typeof second === 'function') {
      return { name: first, options: {}, factory: second }
    }

    const options = second ?? {}

    return { name: first, options, factory: third ?? this.requireEmbeddedFactory(first, options) }
  }

  private requireEmbeddedFactory(name: string, options: RegistrationOptions): (deps: TDeps) => (...args: any[]) => any {
    const { factory } = options as RegistrationWithFactory<TDeps>

    if (!factory) {
      throw new ForgeAuthoringError({
        message: `The ${this.functionType} registration "${name}" has no factory - pass one positionally or as options.factory`,
      })
    }

    return factory
  }

  protected store(name: string, options: RegistrationOptions, factory: (deps: TDeps) => (...args: any[]) => any): void {
    if (this.registrations.has(name)) {
      throw new ForgeRegistryDuplicateError({
        registryType: 'function',
        itemName: name,
        message: `A ${this.functionType} is already registered under the name "${name}"`,
      })
    }

    this.registrations.set(name, {
      name,
      inputSchema: options.inputSchema,
      argumentsSchema: options.argumentsSchema,
      outputSchema: options.outputSchema ?? this.defaultOutputSchema,
      prepare: options.prepare,
      factory,
    })
  }

  protected buildExpressionHandle(name: string, prepare?: (...args: any[]) => any[]): (...args: any[]) => any {
    const type = this.functionType

    if (type === FunctionCallType.GENERATOR) {
      const generatorHandle = (...args: any[]) => {
        const prepared = prepare ? prepare(...args) : args
        const builder = GeneratorBuilder.create(name, prepared)

        stampCallsite(builder, captureCallsite(generatorHandle))
        return builder
      }

      return generatorHandle
    }

    const expressionHandle = (...args: any[]) => {
      const prepared = prepare ? prepare(...args) : args
      const expr = { _forge: type, name, arguments: prepared }

      stampCallsite(expr, captureCallsite(expressionHandle))
      return expr
    }

    return expressionHandle
  }

  getDefinitions(): FunctionDefinitionObject<TDeps> {
    const definitions: FunctionDefinitionObject<TDeps> = {}

    this.registrations.forEach((registration, name) => {
      definitions[name] = {
        name,
        factory: registration.factory,
        inputSchema: registration.inputSchema,
        argumentsSchema: registration.argumentsSchema,
        outputSchema: registration.outputSchema,
        _forge: ENTRY_TAGS[this.functionType],
      }
    })

    return definitions
  }

  build(dependencies?: TDeps): FunctionRegistryObject {
    const resolvedDependencies = (dependencies ?? {}) as TDeps
    const registry = {} as FunctionRegistryObject
    const errors: Error[] = []

    this.registrations.forEach((registration, name) => {
      try {
        const evaluate = registration.factory(resolvedDependencies)

        if (typeof evaluate !== 'function') {
          throw new TypeError(`Function "${name}" factory must return an evaluator function`)
        }

        registry[name] = {
          name,
          evaluate,
          inputSchema: registration.inputSchema,
          argumentsSchema: registration.argumentsSchema,
          outputSchema: registration.outputSchema,
          _forge: ENTRY_TAGS[this.functionType],
        }
      } catch (cause) {
        errors.push(
          new ForgeFunctionEntryBuildError({
            functionName: name,
            functionType: ENTRY_TAGS[this.functionType],
            cause,
          }),
        )
      }
    })

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Function preparation failed')
    }

    return registry
  }
}

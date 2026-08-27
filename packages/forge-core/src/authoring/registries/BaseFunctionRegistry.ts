import { z, type ZodType } from 'zod'
import { FunctionCallType, FunctionEntryType } from '../types/enums'
import ForgeAuthoringError from '../../engine/errors/ForgeAuthoringError'
import ForgeRegistryDuplicateError from '../../engine/errors/ForgeRegistryDuplicateError'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import { captureCallsite, stampCallsite } from '../builders/utils/captureCallsite'
import type { FunctionRegistryBuilder, FunctionRegistryObject } from '../types/functions.type'

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

  build(deps?: TDeps): FunctionRegistryObject {
    const resolvedDeps = (deps ?? {}) as TDeps
    const registry = {} as FunctionRegistryObject

    this.registrations.forEach((registration, name) => {
      const evaluate = registration.factory(resolvedDeps)

      registry[name] = {
        name,
        evaluate,
        isAsync: evaluate.constructor.name === 'AsyncFunction',
        inputSchema: registration.inputSchema,
        argumentsSchema: registration.argumentsSchema,
        outputSchema: registration.outputSchema,
        _forge: ENTRY_TAGS[this.functionType],
      }
    })

    return registry
  }
}

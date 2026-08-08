import { z, type ZodType } from 'zod'
import { FunctionType } from '../types/enums'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import type { FunctionRegistryObject } from '../types/functions.type'

export interface RegistrationOptions {
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  prepare?: (...args: any[]) => any[]
}

export interface RegistrationWithFactory<TDeps = any> extends RegistrationOptions {
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

// Each rolldown entry point (core, core/authoring) inlines its own copy of this class, so
// `instanceof` fails when an instance from one bundle reaches a check in another. The
// Symbol.for brand is process-global, so it survives the duplication.
//
// TODO: Probably should delete the brand/symbol machinery once the deprecated
// implementations-map form of `functions` is removed — at that point the engine only needs
// Array.isArray before calling .build(), and never needs to identify a registry.
const REGISTRY_BRAND = Symbol.for('forge:BaseFunctionRegistry')

export function isFunctionRegistry<T = any>(value: unknown): value is BaseFunctionRegistry<T> {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[REGISTRY_BRAND] === true
}

export abstract class BaseFunctionRegistry<TDeps = Record<string, never>> {
  readonly [REGISTRY_BRAND] = true

  private readonly registrations = new Map<string, StoredRegistration>()

  private anonymousCounter = 0

  constructor(
    private readonly functionType: FunctionType,
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
      throw new Error(
        `The ${this.functionType} registration "${name}" has no factory - pass one positionally or as options.factory`,
      )
    }

    return factory
  }

  protected store(name: string, options: RegistrationOptions, factory: (deps: TDeps) => (...args: any[]) => any): void {
    if (this.registrations.has(name)) {
      throw new Error(`A ${this.functionType} is already registered under the name "${name}"`)
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

    if (type === FunctionType.GENERATOR) {
      return (...args: any[]) => {
        const prepared = prepare ? prepare(...args) : args

        return GeneratorBuilder.create(name, prepared)
      }
    }

    return (...args: any[]) => {
      const prepared = prepare ? prepare(...args) : args

      return { type, name, arguments: prepared }
    }
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
        functionType: this.functionType,
      }
    })

    return registry
  }
}

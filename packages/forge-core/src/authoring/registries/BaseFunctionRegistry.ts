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

interface StoredRegistration {
  name: string
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  prepare?: (...args: any[]) => any[]
  factory: (deps: any) => (...args: any[]) => any
}

export const CONDITION_OUTPUT_SCHEMA = z.boolean()

export abstract class BaseFunctionRegistry<TDeps = Record<string, never>> {
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
      return { name: this.nextAnonymousName(), options: {}, factory: first }
    }

    if (typeof first !== 'string') {
      return { name: this.nextAnonymousName(), options: first, factory: second as any }
    }

    if (typeof second === 'function') {
      return { name: first, options: {}, factory: second }
    }

    return { name: first, options: second as RegistrationOptions, factory: third! }
  }

  protected store(name: string, options: RegistrationOptions, factory: (deps: TDeps) => (...args: any[]) => any): void {
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

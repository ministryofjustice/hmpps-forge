import { FunctionRegistryObject } from '../types/functions.type'
import { EffectFunctionContext } from '../../engine/nodes/expressions/effect/EffectFunctionContext'
import {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  FunctionExpr,
  GeneratorFunctionExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import { ChainableRef } from '../builders/types'
import { FunctionType } from '../types/enums'

/**
 * Utility type that extracts all parameters except the first from a tuple type.
 * Used to get the arguments for function expressions after removing the context/value parameter.
 *
 * @template T - The tuple type to process
 * @example
 * type Args = Tail<[value: string, min: number, max: number]> // [min: number, max: number]
 */
type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never

/**
 * Maps a FunctionType enum value to its corresponding expression type.
 * This ensures that function builders return the correct expression shape.
 *
 * @template FT - The FunctionType enum value
 * @template A - The arguments array type
 * @returns The corresponding function expression type
 */
type ExprFor<FT, A extends any[]> = FT extends FunctionType.EFFECT
  ? EffectFunctionExpr<A>
  : FT extends FunctionType.CONDITION
    ? ConditionFunctionExpr<A>
    : FT extends FunctionType.TRANSFORMER
      ? TransformerFunctionExpr<A>
      : FT extends FunctionType.GENERATOR
        ? GeneratorFunctionExpr<A>
        : never

/**
 * Detect if a function is async by checking its constructor
 *
 * Returns true for:
 * - async function declarations: async function foo() {}
 * - async arrow functions: async () => {}
 * - async methods: async foo() {}
 *
 * Returns false for:
 * - Regular functions that return Promises (requires async keyword)
 */
export function isAsyncFunction(fn: (...args: any[]) => any): boolean {
  return fn.constructor.name === 'AsyncFunction'
}

type NoDeps = Record<string, never>

/**
 * Type helper to extract the evaluator function type from a factory function.
 * Factory: (deps: D) => (context, ...args) => void
 * Evaluator: (context, ...args) => void
 */
type EvaluatorFromFactory<F> = F extends (deps: any) => infer E ? E : never

/**
 * Type helper to safely extract parameters from evaluator, with fallback to any[].
 */
type SafeTailParams<F> = F extends (...args: any[]) => any ? Tail<Parameters<F>> : any[]

/**
 * Type helper to build function builders from factory functions for a given function type.
 * Maps each factory to a builder function that takes the args (minus context/value) and returns an expression.
 */
type FunctionBuildersFromFactories<Fns, FT extends FunctionType> = {
  [K in keyof Fns]: (
    ...args: SafeTailParams<EvaluatorFromFactory<Fns[K]>>
  ) => ExprFor<FT, SafeTailParams<EvaluatorFromFactory<Fns[K]>>>
}

/**
 * Generic helper to create function definitions with dependency injection.
 * This is the core implementation used by defineEffects, defineConditions,
 * and defineTransformers.
 *
 * This pattern separates builder creation from registry creation:
 * - Builders can be used in form definitions without dependencies
 * - Registry is created at runtime with real dependencies
 *
 * @template D - The dependencies type
 * @template FT - The FunctionType (EFFECT, CONDITION, or TRANSFORMER)
 *
 * @param functionType - The FunctionType enum value
 *
 * @param factories - Object mapping function names to dependency-aware factories
 *
 * @returns Object containing function builders and a createRegistry helper
 */
function defineFunctionsWithDeps<
  D,
  FT extends FunctionType,
  Fns extends Record<string, (deps: D) => (...args: any[]) => any>,
>(functionType: FT, factories: Fns) {
  type Builders = FunctionBuildersFromFactories<Fns, FT>

  // Create builders from factory keys only - no deps needed
  const functions = {} as Builders

  Object.keys(factories).forEach(name => {
    ;(functions as any)[name] = (...args: any[]): FunctionExpr<any> => ({
      type: functionType,
      name,
      arguments: args,
    })
  })

  // Factory function to create registry with real dependencies
  const createRegistry = (deps: D): FunctionRegistryObject => {
    const registry = {} as FunctionRegistryObject

    Object.entries(factories).forEach(([name, factory]) => {
      const evaluate = factory(deps)
      const isAsync = isAsyncFunction(evaluate)
      ;(registry as any)[name] = { name, evaluate, isAsync }
    })

    return registry
  }

  return { functions, createRegistry }
}

/**
 * Creates effect functions with dependency injection from factory functions.
 * This separates builder creation from registry creation:
 * - `effects`: Available immediately for use in form definitions (no deps needed)
 * - `createRegistry`: Factory function to create registry with real dependencies at runtime
 *
 * @template D - The dependencies type
 *
 * @param factories - Effect factories keyed by function name
 *
 * @returns Object containing effect builders and createRegistry
 *
 * @example
 * // effects.ts - define effects with factory pattern
 * export const { effects: MyEffects, createRegistry } = defineEffects<MyDeps>({
 *   SendEmail: (deps) => (context, recipient: string) => {
 *     return deps.emailService.send(recipient, context.formData)
 *   },
 *   LogAction: (deps) => (context, action: string) => {
 *     deps.logger.info(`${action}: ${context.formId}`)
 *   }
 * })
 *
 * // app.ts - create registry with real dependencies
 * const registry = createRegistry({ emailService, logger })
 * formEngine.registerFunctions(registry)
 *
 * // step.ts - use effects in form definitions (no deps needed)
 * effects: [MyEffects.SendEmail('user@example.com')]
 */
export function defineEffects<
  D = NoDeps,
  Fns extends Record<
    string,
    (deps: D) => (context: EffectFunctionContext, ...args: ValueExpr[]) => void | Promise<void>
  > = Record<string, (deps: D) => (context: EffectFunctionContext, ...args: ValueExpr[]) => void | Promise<void>>,
>(factories: Fns) {
  const { functions, createRegistry } = defineFunctionsWithDeps<D, FunctionType.EFFECT, Fns>(
    FunctionType.EFFECT,
    factories,
  )

  return { effects: functions, createRegistry }
}

/**
 * Creates condition functions with dependency injection from factory functions.
 * This pattern is used for all conditions, including ones that do not need dependencies.
 *
 * This API separates builder creation from registry creation:
 * - `conditions`: Available immediately for use in form definitions (no deps needed)
 * - `createRegistry`: Factory function to create registry with real dependencies at runtime
 *
 * If a condition does not need dependencies, ignore the `deps` argument in the factory
 * and call `createRegistry({})`.
 *
 * @template D - The dependencies type
 *
 * @param factories - Condition factories keyed by function name
 *
 * @returns Object containing condition builders and createRegistry
 *
 * @example
 * // conditions.ts - define conditions with factory pattern
 * export const { conditions: MyConditions, createRegistry } = defineConditions<MyDeps>({
 *   IsValidUser: (deps) => async (userId: string) => {
 *     return deps.apiClient.validateUser(userId)
 *   },
 *   MeetsAgeRequirement: (deps) => (age: number) => {
 *     return age >= deps.config.minAge
 *   }
 * })
 *
 * // app.ts - create registry with real dependencies
 * const registry = createRegistry({ apiClient, config })
 * formEngine.registerFunctions(registry)
 *
 * // step.ts - use conditions in form definitions (no deps needed)
 * validation({ when: Self().not.match(MyConditions.IsValidUser()) })
 */
export function defineConditions<
  D = NoDeps,
  Fns extends Record<string, (deps: D) => (value: unknown, ...args: any[]) => boolean | Promise<boolean>> = Record<
    string,
    (deps: D) => (value: unknown, ...args: any[]) => boolean | Promise<boolean>
  >,
>(factories: Fns) {
  const { functions, createRegistry } = defineFunctionsWithDeps<D, FunctionType.CONDITION, Fns>(
    FunctionType.CONDITION,
    factories,
  )

  return { conditions: functions, createRegistry }
}

/**
 * Creates transformer functions with dependency injection from factory functions.
 * This pattern is used for all transformers, including ones that do not need dependencies.
 *
 * This API separates builder creation from registry creation:
 * - `transformers`: Available immediately for use in form definitions (no deps needed)
 * - `createRegistry`: Factory function to create registry with real dependencies at runtime
 *
 * If a transformer does not need dependencies, ignore the `deps` argument in the factory
 * and call `createRegistry({})`.
 *
 * @template D - The dependencies type
 *
 * @param factories - Transformer factories keyed by function name
 *
 * @returns Object containing transformer builders and createRegistry
 *
 * @example
 * // transformers.ts - define transformers with factory pattern
 * export const { transformers: MyTransformers, createRegistry } = defineTransformers<MyDeps>({
 *   FormatDate: (deps) => (value: Date, format?: string) => {
 *     return deps.formatter.format(value, format, deps.config.defaultLocale)
 *   },
 *   LocalizeNumber: (deps) => (value: number) => {
 *     return value.toLocaleString(deps.config.defaultLocale)
 *   }
 * })
 *
 * // app.ts - create registry with real dependencies
 * const registry = createRegistry({ formatter, config })
 * formEngine.registerFunctions(registry)
 *
 * // step.ts - use transformers in form definitions (no deps needed)
 * formatters: [MyTransformers.FormatDate('YYYY-MM-DD')]
 */
export function defineTransformers<
  D = NoDeps,
  Fns extends Record<string, (deps: D) => (value: unknown, ...args: any[]) => ValueExpr | Promise<ValueExpr>> = Record<
    string,
    (deps: D) => (value: unknown, ...args: any[]) => ValueExpr | Promise<ValueExpr>
  >,
>(factories: Fns) {
  const { functions, createRegistry } = defineFunctionsWithDeps<D, FunctionType.TRANSFORMER, Fns>(
    FunctionType.TRANSFORMER,
    factories,
  )

  return { transformers: functions, createRegistry }
}

/**
 * Creates generator functions with dependency injection from factory functions.
 * This pattern is used for all generators, including ones that do not need dependencies.
 *
 * This API separates builder creation from registry creation:
 * - `generators`: Available immediately for use in form definitions (no deps needed)
 * - `createRegistry`: Factory function to create registry with real dependencies at runtime
 *
 * If a generator does not need dependencies, ignore the `deps` argument in the factory
 * and call `createRegistry({})`.
 *
 * @template D - The dependencies type
 *
 * @param factories - Generator factories keyed by function name
 *
 * @returns Object containing generator builders and createRegistry
 *
 * @example
 * // generators.ts - define generators with factory pattern
 * export const { generators: MyGenerators, createRegistry } = defineGenerators<MyDeps>({
 *   CurrentUser: (deps) => () => deps.userService.getCurrentUser(),
 *   ServerTime: (deps) => async () => {
 *     const response = await deps.timeApi.getServerTime()
 *     return new Date(response.timestamp)
 *   }
 * })
 *
 * // app.ts - create registry with real dependencies
 * const registry = createRegistry({ userService, timeApi })
 * formEngine.registerFunctions(registry)
 *
 * // step.ts - use generators in form definitions (no deps needed)
 * defaultValue: MyGenerators.CurrentUser()
 */
export function defineGenerators<
  D = NoDeps,
  Fns extends Record<string, (deps: D) => (...args: ValueExpr[]) => ValueExpr | Promise<ValueExpr>> = Record<
    string,
    (deps: D) => (...args: ValueExpr[]) => ValueExpr | Promise<ValueExpr>
  >,
>(factories: Fns) {
  /**
   * Type for the function builders that create generator expressions.
   * The return type hides internal methods like build() and expr, exposing only pipe/match/not.
   */
  type Builders = {
    [K in keyof Fns]: Fns[K] extends (deps: D) => infer Eval
      ? Eval extends (...args: infer A) => any
        ? (...args: A) => ChainableRef
        : never
      : never
  }

  // Create builders from factory keys only - no deps needed
  const generators = {} as Builders

  Object.keys(factories).forEach(name => {
    ;(generators as any)[name] = (...args: any[]) => GeneratorBuilder.create(name, args)
  })

  // Factory function to create registry with real dependencies
  const createRegistry = (deps: D): FunctionRegistryObject => {
    const registry = {} as FunctionRegistryObject

    Object.entries(factories).forEach(([name, factory]) => {
      const evaluate = factory(deps)

      // Detect if function is async
      const isAsync = isAsyncFunction(evaluate)

      // FunctionHandler knows generators don't receive @value, so we pass the evaluator directly
      ;(registry as any)[name] = {
        name,
        evaluate,
        isAsync,
      }
    })

    return registry
  }

  return { generators, createRegistry }
}

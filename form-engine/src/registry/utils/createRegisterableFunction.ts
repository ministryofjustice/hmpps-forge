import { EffectFunctionExpr, FunctionExpr, ValueExpr } from '../../form/types/expressions.type'
import { FunctionType } from '../../form/types/enums'

/**
 * Function evaluator type that processes value expressions with additional arguments.
 */
export type FunctionEvaluator<A extends ValueExpr[], R = any> = (value: ValueExpr, ...args: A) => R | Promise<R>

/**
 * Registry function interface that combines a callable function with its specification.
 */
export interface RegistryFunction<A extends ValueExpr[], R = any, T extends FunctionExpr<A> = FunctionExpr<A>> {
  /**
   * Callable function that creates a function expression
   * @param args - Arguments to pass to the function
   * @returns A function expression of type T
   */
  (...args: A): T
  /**
   * Function specification containing metadata and evaluation logic
   */
  spec: {
    /** Unique name identifier for the function */
    name: string
    /** Function that evaluates the expression with given arguments */
    evaluate: FunctionEvaluator<A, R>
  }
}

/**
 * Creates a registerable function that can be added to the form engine registry.
 * This helper ensures proper typing and integration with the form engine's AST.
 *
 * @param type - The function type (Condition, Transformer, Effect) from FunctionType enum
 * @param name - Unique identifier for the function, used for registry lookup
 * @param evaluator - Function that performs the actual evaluation or transformation
 *
 * @returns A RegistryFunction that can be called to create function expressions
 *          and registered with the form engine
 *
 * Aside from being able to call the function, which generates an output like
 * ```
 * {
 *    type: FunctionType.Effect,
 *    name: 'someEffectFunction',
 *    arguments: ['arg_1', 'arg_2'],
 * }
 * ```
 * This output is used in the form configuration. There is also a 'spec' property,
 * accessed like `someEffectFunction.spec`, which returns
 * ```
 *    name: 'someEffectFunction',
 *    evaluate: Function
 * ```
 * which is how the function and its implementation are registered in the form-engine.
 *
 * @example
 * ```typescript
 * const isEven = createRegisterableFunction(
 *   FunctionType.Condition,
 *   'isEven',
 *   (value) => typeof value === 'number' && value % 2 === 0
 * )
 *
 * // Usage in form configuration
 * Answer('count').match(isEven())
 * ```
 */
export function createRegisterableFunction<A extends ValueExpr[], R = any, T extends FunctionExpr<A> = FunctionExpr<A>>(
  type: FunctionType,
  name: string,
  evaluator: FunctionEvaluator<A, R>,
): RegistryFunction<A, R, T> {
  const fn = (...args: A) =>
    ({
      type,
      name,
      arguments: args,
    }) as T

  ;(fn as RegistryFunction<A, R, T>).spec = {
    name,
    evaluate: evaluator,
  }

  return fn as RegistryFunction<A, R, T>
}

/**
 * Simple factory function type that returns a RegistryFunction when given dependencies
 */
export type InjectableFactory<TDeps, TArgs extends ValueExpr[], TReturn, TExpr extends FunctionExpr<TArgs>> = (
  deps: TDeps,
) => RegistryFunction<TArgs, TReturn, TExpr>

/**
 * Type helper to create proxy type that mimics registry functions but returns AST nodes
 */
type ProxyFunction<T> =
  T extends InjectableFactory<any, infer TArgs, any, infer TExpr> ? (...args: TArgs) => TExpr : never

/**
 * Maps an object of injectable functions to their proxy equivalents
 */
export type InjectableProxy<T extends Record<string, InjectableFactory<any, any, any, any>>> = {
  [K in keyof T]: ProxyFunction<T[K]>
}

/**
 * Creates a proxy object that mimics registry functions for use in form configurations.
 * The proxy functions return AST nodes without requiring dependency injection.
 *
 * @param factories - Object containing injectable factory functions
 * @param functionType - The type of function (Effect, Condition, Transformer)
 * @returns Proxy object with same shape as registry functions
 *
 * @example
 * const effectFactories = {
 *   Save: (service) => buildEffectFunction('saveEffect', async (ctx) => service.save(ctx))
 * }
 *
 * const Effects = createInjectableProxy(effectFactories, FunctionType.EFFECT)
 * // Usage: Effects.Save() returns { type: 'FunctionType.EFFECT', name: 'saveEffect', arguments: [] }
 */
export function createInjectableProxy<T extends Record<string, InjectableFactory<any, any, any, any>>>(
  factories: T,
  functionType: FunctionType,
): InjectableProxy<T> {
  const proxy: any = {}

  for (const [key, factory] of Object.entries(factories)) {
    let functionName: string
    try {
      const tempInstance = factory(null as any)
      functionName = tempInstance.spec.name
    } catch {
      functionName = key
    }

    proxy[key] = (...args: any[]) => ({
      type: functionType,
      name: functionName,
      arguments: args,
    })
  }

  return proxy as InjectableProxy<T>
}

/**
 * Resolves injectable functions with their dependencies to create registry entries.
 *
 * @param factories - Object containing injectable factory functions
 * @param dependencies - The dependencies to inject into the factories
 * @returns Object mapping function names to their implementations
 *
 * @example
 * const effectFactories = {
 *   Save: (service) => buildEffectFunction('saveEffect', async (ctx) => service.save(ctx))
 * }
 *
 * const resolved = resolveInjectableFunctions(effectFactories, myService)
 * // Returns: { 'saveEffect': { name: 'saveEffect', evaluate: [Function] } }
 * formEngine.registerFunctions(resolved)
 */
export function resolveInjectableFunctions<TDeps, T extends Record<string, InjectableFactory<TDeps, any, any, any>>>(
  factories: T,
  dependencies: TDeps,
): Record<string, { name: string; evaluate: (...args: any[]) => any }> {
  const resolved: Record<string, { name: string; evaluate: (...args: any[]) => any }> = {}

  for (const [, factory] of Object.entries(factories)) {
    const registryFunction = factory(dependencies)
    resolved[registryFunction.spec.name] = registryFunction.spec
  }

  return resolved
}

/**
 * Helper to create injectable effect proxy with proper typing
 */
export function createInjectableFunctions<
  T extends Record<string, InjectableFactory<any, any, any, EffectFunctionExpr<any>>>,
>(factories: T, functionType: FunctionType): InjectableProxy<T> {
  return createInjectableProxy(factories, functionType)
}

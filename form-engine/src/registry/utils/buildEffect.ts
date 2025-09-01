import {
  FunctionEvaluator,
  RegistryFunction,
  createRegisterableFunction,
} from '@form-engine/registry/utils/createRegisterableFunction'
import { EffectFunctionExpr, ValueExpr } from '../../form/types/expressions.type'
import { FunctionType } from '../../form/types/enums'

/**
 * Creates a registerable effect function for side effects in form transitions.
 * Effect functions perform actions like loading data, saving state, logging analytics,
 * or any other side effects needed during the form lifecycle.
 *
 * @param name - Unique identifier for the effect function in camelCase
 *
 * @param evaluator - Function that performs the actual effect.
 * First parameter is always the context, with additional parameters being passed in as arguments.
 *
 * @returns A registerable function that can be called with arguments
 * to create an EffectFunctionExpr for use in transitions, and has a `spec`
 * property containing the name and evaluator for registration.
 *
 * @example
 * // Simple effect without parameters
 * const Save = buildEffectFunction(
 *   'save',
 *   async (data) => {
 *     await api.saveAssessment(data)
 *   }
 * )
 *
 * @example
 * // Effect with parameters
 * const LoadSection = buildEffectFunction(
 *   'loadSection',
 *   async (context, sectionName: string) => {
 *     const data = await api.loadSection(sectionName)
 *     context.setData(sectionName, data)
 *   }
 * )
 *
 */
export const buildEffectFunction = <A extends readonly ValueExpr[]>(
  name: string,
  evaluator: FunctionEvaluator<A>,
): RegistryFunction<A, any, EffectFunctionExpr<A>> =>
  createRegisterableFunction<A, any, EffectFunctionExpr<A>>(FunctionType.EFFECT, name, evaluator)

/**
 * Helper to create dependency-injected effects with proper TypeScript inference.
 * This allows defining effects that require external dependencies (services, configs,
 * utilities, etc.) while hiding the injection parameter from the type signature used in
 * the form configuration.
 * // TODO: Maybe a better way to do this?
 *
 * @example
 * ```typescript
 * // Define effects with dependency injection
 * const myEffects = {
 *   DoSomething: (service: MyService) =>
 *     buildEffectFunction('doSomething', async (context, param: string) => {
 *       return service.performAction(param)
 *     })
 * }
 *
 * // Resolve the types for use in the form configuration
 * const MyEffects = resolveInjectedEffectsType(myEffects)
 *
 * // Later, resolve with actual dependency, for use in the form engine registry
 * const resolvedEffects = resolveInjectedEffects(myEffects, myServiceInstance)
 * ```
 */
export function resolveInjectedEffectsType<D, T extends Record<string, (deps: D) => any>>(
  effects: T,
): { [K in keyof T]: ReturnType<T[K]> } {
  return effects as any
}

/**
 * Resolves dependency-injected effects by providing the required dependencies.
 * Takes an object of effect factory functions and injects the dependencies
 * to produce the actual RegistryFunction objects for registering within the form engine.
 *
 * @param effects - Object containing effect factory functions
 *                  Each property should be a higher-order-function that takes dependencies and returns a RegistryFunction.
 *
 * @param dependencies - The dependencies to inject into each effect factory function.
 *                       This can be a service instance, configuration object, or any other dependency
 *                       that the effects require to function.
 *
 * @returns An object with the same keys as the input effects object, but with each factory function
 *          resolved to its corresponding RegistryFunction by injecting the provided dependencies.
 *
 * @example
 * ```typescript
 * // Define effects with dependency injection
 * const myEffects = {
 *   Save: (service: MyService) =>
 *     buildEffectFunction('save', async (context, data) => {
 *       return service.save(data)
 *     }),
 *   Load: (service: MyService) =>
 *     buildEffectFunction('load', async (context, id: string) => {
 *       return service.load(id)
 *     })
 * }
 *
 * // Resolve with actual service instance
 * const resolvedEffects = resolveInjectedEffects(myEffects, myServiceInstance)
 *
 * // Or register with form engine
 * formEngine.registerEffects(resolvedEffects)
 * ```
 */
export const resolveInjectedEffects = <T extends Record<string, (deps: any) => any>>(
  effects: T,
  dependencies: any,
): { [K in keyof T]: ReturnType<T[K]> } => {
  const resolved: any = {}

  for (const [key, effectFactory] of Object.entries(effects)) {
    if (typeof effectFactory === 'function') {
      resolved[key] = effectFactory(dependencies)
    }
  }

  return resolved
}

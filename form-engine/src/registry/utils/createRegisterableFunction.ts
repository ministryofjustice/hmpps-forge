import { FunctionRegistryObject } from '@form-engine/registry/types/functions.type'
import EffectFunctionContext from '@form-engine/core/ast/thunks/EffectFunctionContext'
import {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  FunctionExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../../form/types/expressions.type'
import { FunctionType } from '../../form/types/enums'

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
      : never

/**
 * Core function that creates both function builders and registry entries from evaluator functions.
 * This function reduces duplication across conditions, transformers, and effects by handling
 * the common pattern of creating expression builders and registry entries.
 *
 * @template CtxOrValue - The first parameter type (context for effects, value for conditions/transformers)
 * @template FT - The FunctionType enum value (CONDITION, TRANSFORMER, or EFFECT)
 * @template Evals - Record of evaluator functions keyed by function name
 *
 * @param type - The FunctionType enum value for the expression type
 * @param evaluators - Object mapping function names to their evaluator functions
 *
 * @returns Object containing:
 * - `functions`: Function builders that create function expressions when called
 * - `registry`: Registry object with `{ name, evaluate }` entries for runtime use
 *
 * @example
 * const { functions, registry } = defineFunctionSet(FunctionType.CONDITION, {
 *   IsPositive: (value: number) => value > 0,
 *   IsEven: (value: number) => value % 2 === 0
 * })
 *
 * // functions.IsPositive() creates a condition expression
 * // registry.IsPositive contains { name: 'IsPositive', evaluate: (value) => value > 0 }
 */
function defineFunctionSet<
  CtxOrValue,
  FT extends FunctionType,
  Evals extends Record<string, (ctxOrValue: CtxOrValue, ...args: ValueExpr[]) => any>,
>(type: FT, evaluators: Evals) {
  /**
   * Type for the function builders that create function expressions.
   * Each function takes the arguments (excluding the first context/value param)
   * and returns the appropriate expression type.
   */
  type Proxies = {
    [K in keyof Evals]: (...args: Tail<Parameters<Evals[K]>>) => ExprFor<FT, Tail<Parameters<Evals[K]>>>
  }

  const functions = {} as Proxies
  const registry = {} as FunctionRegistryObject

  Object.entries(evaluators).forEach(([name, evaluate]) => {
    // Create function builder that generates expressions
    ;(functions as any)[name] = (...args: any[]): FunctionExpr<any> => ({
      type,
      name,
      arguments: args,
    })

    // Create registry entry for runtime evaluation
    ;(registry as any)[name] = { name, evaluate }
  })

  return { functions, registry }
}

/**
 * Creates effect functions and their registry from evaluator functions.
 * Effects are side effect operations that can be triggered during form processing.
 *
 * @template E - Record of effect evaluator functions
 *
 * @param evaluators - Object mapping effect names to evaluator functions
 *   Each evaluator receives a EffectFunctionContext and additional arguments
 *
 * @returns Object containing:
 * - `effects`: Function builders for creating effect expressions in form definitions
 * - `registry`: Registry entries for runtime effect execution
 *
 * @example
 * const { effects, registry } = defineEffects({
 *   SendEmail: (context, recipient: string, subject: string) => {
 *     return context.emailService.send(recipient, subject, context.formData)
 *   },
 *   LogSubmission: (context) => {
 *     console.log('Form submitted:', context.formData)
 *   }
 * })
 *
 * // Usage in form definition:
 * // effects.SendEmail('user@example.com', 'Form Submitted')
 */
export function defineEffects<
  E extends Record<string, (context: EffectFunctionContext, ...args: ValueExpr[]) => void | Promise<void>>,
>(evaluators: E) {
  const { functions, registry } = defineFunctionSet<EffectFunctionContext, FunctionType.EFFECT, E>(
    FunctionType.EFFECT,
    evaluators,
  )

  return { effects: functions, registry }
}

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
 * This is the core implementation used by defineEffectsWithDeps, defineConditionsWithDeps,
 * and defineTransformersWithDeps.
 *
 * The curried pattern separates builder creation from registry creation:
 * - Builders can be used in form definitions without dependencies
 * - Registry is created at runtime with real dependencies
 *
 * @template D - The dependencies type
 * @template FT - The FunctionType (EFFECT, CONDITION, or TRANSFORMER)
 *
 * @param functionType - The FunctionType enum value
 *
 * @returns A curried function that accepts factory definitions and returns { functions, createRegistry }
 */
function defineFunctionsWithDeps<D, FT extends FunctionType>(functionType: FT) {
  return <Fns extends Record<string, (deps: D) => (...args: any[]) => any>>(factories: Fns) => {
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
        ;(registry as any)[name] = { name, evaluate }
      })

      return registry
    }

    return { functions, createRegistry }
  }
}

/**
 * Creates effect functions with dependency injection from factory functions.
 * This variant allows effects to depend on external services or configuration.
 *
 * Unlike defineEffects, this separates builder creation from registry creation:
 * - `effects`: Available immediately for use in form definitions (no deps needed)
 * - `createRegistry`: Factory function to create registry with real dependencies at runtime
 *
 * @template D - The dependencies type
 *
 * @returns A curried function that accepts factory definitions
 *
 * @example
 * // effects.ts - define effects with factory pattern
 * export const { effects: MyEffects, createRegistry } = defineEffectsWithDeps<MyDeps>()({
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
export function defineEffectsWithDeps<D>() {
  return <
    Fns extends Record<
      string,
      (deps: D) => (context: EffectFunctionContext, ...args: ValueExpr[]) => void | Promise<void>
    >,
  >(
    factories: Fns,
  ) => {
    const { functions, createRegistry } = defineFunctionsWithDeps<D, FunctionType.EFFECT>(FunctionType.EFFECT)(
      factories,
    )

    return { effects: functions, createRegistry }
  }
}

/**
 * Creates condition functions and their registry from evaluator functions.
 * Conditions are boolean predicates used for validation, visibility, and conditional logic.
 *
 * @template E - Record of condition evaluator functions
 *
 * @param evaluators - Object mapping condition names to evaluator functions
 *   Each evaluator receives a value and additional arguments, returns boolean or Promise<boolean>
 *
 * @returns Object containing:
 * - `conditions`: Function builders for creating condition expressions in form definitions
 * - `registry`: Registry entries for runtime condition evaluation
 *
 * @example
 * const { conditions, registry } = defineConditions({
 *   IsPositive: (value: number) => value > 0,
 *   HasMinLength: (value: string, min: number) => value.length >= min,
 *   IsValidEmail: async (value: string) => {
 *     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
 *   }
 * })
 *
 * // Usage in form definition:
 * // conditions.HasMinLength(5) creates a condition expression
 * // registry.HasMinLength contains the evaluator for runtime use
 */
export function defineConditions<
  E extends Record<string, (value: ValueExpr, ...args: ValueExpr[]) => boolean | Promise<boolean>>,
>(evaluators: E) {
  const { functions, registry } = defineFunctionSet<ValueExpr, FunctionType.CONDITION, E>(
    FunctionType.CONDITION,
    evaluators,
  )

  return { conditions: functions, registry }
}

/**
 * Creates condition functions with dependency injection from factory functions.
 * This variant allows conditions to depend on external services, APIs, or configuration.
 *
 * Unlike defineConditions, this separates builder creation from registry creation:
 * - `conditions`: Available immediately for use in form definitions (no deps needed)
 * - `createRegistry`: Factory function to create registry with real dependencies at runtime
 *
 * @template D - The dependencies type
 *
 * @returns A curried function that accepts factory definitions
 *
 * @example
 * // conditions.ts - define conditions with factory pattern
 * export const { conditions: MyConditions, createRegistry } = defineConditionsWithDeps<MyDeps>()({
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
export function defineConditionsWithDeps<D>() {
  return <
    Fns extends Record<string, (deps: D) => (value: ValueExpr, ...args: ValueExpr[]) => boolean | Promise<boolean>>,
  >(
    factories: Fns,
  ) => {
    const { functions, createRegistry } = defineFunctionsWithDeps<D, FunctionType.CONDITION>(FunctionType.CONDITION)(
      factories,
    )

    return { conditions: functions, createRegistry }
  }
}

/**
 * Creates transformer functions and their registry from evaluator functions.
 * Transformers modify values during form processing (formatting, conversion, etc.).
 *
 * @template E - Record of transformer evaluator functions
 *
 * @param evaluators - Object mapping transformer names to evaluator functions
 *   Each evaluator receives a value and additional arguments, returns transformed value or Promise<ValueExpr>
 *
 * @returns Object containing:
 * - `transformers`: Function builders for creating transformer expressions in form definitions
 * - `registry`: Registry entries for runtime value transformation
 *
 * @example
 * const { transformers, registry } = defineTransformers({
 *   ToUpperCase: (value: string) => value.toUpperCase(),
 *   FormatCurrency: (value: number, currency = 'USD') => {
 *     return new Intl.NumberFormat('en-US', {
 *       style: 'currency',
 *       currency
 *     }).format(value)
 *   },
 *   Truncate: (value: string, maxLength: number) => {
 *     return value.length > maxLength ? value.slice(0, maxLength) + '...' : value
 *   }
 * })
 *
 * // Usage in form definition:
 * // transformers.FormatCurrency('EUR') creates a transformer expression
 * // registry.FormatCurrency contains the evaluator for runtime use
 */
export function defineTransformers<
  E extends Record<string, (value: ValueExpr, ...args: ValueExpr[]) => ValueExpr | Promise<ValueExpr>>,
>(evaluators: E) {
  const { functions, registry } = defineFunctionSet<ValueExpr, FunctionType.TRANSFORMER, E>(
    FunctionType.TRANSFORMER,
    evaluators,
  )

  return { transformers: functions, registry }
}

/**
 * Creates transformer functions with dependency injection from factory functions.
 * This variant allows transformers to depend on external services, formatters, or configuration.
 *
 * Unlike defineTransformers, this separates builder creation from registry creation:
 * - `transformers`: Available immediately for use in form definitions (no deps needed)
 * - `createRegistry`: Factory function to create registry with real dependencies at runtime
 *
 * @template D - The dependencies type
 *
 * @returns A curried function that accepts factory definitions
 *
 * @example
 * // transformers.ts - define transformers with factory pattern
 * export const { transformers: MyTransformers, createRegistry } = defineTransformersWithDeps<MyDeps>()({
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
export function defineTransformersWithDeps<D>() {
  return <
    Fns extends Record<string, (deps: D) => (value: ValueExpr, ...args: ValueExpr[]) => ValueExpr | Promise<ValueExpr>>,
  >(
    factories: Fns,
  ) => {
    const { functions, createRegistry } = defineFunctionsWithDeps<D, FunctionType.TRANSFORMER>(
      FunctionType.TRANSFORMER,
    )(factories)

    return { transformers: functions, createRegistry }
  }
}

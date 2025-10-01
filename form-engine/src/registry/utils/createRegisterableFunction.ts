import { FormEffectContext, FunctionRegistryObject } from '@form-engine/registry/types/functions.type'
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
 * Helper function that materializes dependency-based evaluator functions.
 * Takes factory functions that accept dependencies and returns the actual evaluators.
 *
 * @template D - The dependencies type
 * @template Fns - Record of factory functions that create evaluators
 *
 * @param deps - Dependencies to inject into the factory functions
 * @param factories - Object mapping names to factory functions
 *
 * @returns Object with the same keys but with materialized evaluator functions
 *
 * @example
 * const deps = { apiClient: new ApiClient() }
 * const factories = {
 *   ValidateEmail: (deps) => (email: string) => deps.apiClient.validateEmail(email)
 * }
 * const evaluators = withDeps(deps, factories)
 * // evaluators.ValidateEmail is now (email: string) => boolean
 */
function withDeps<D, Fns extends Record<string, (deps: D) => (...args: any[]) => any>>(deps: D, factories: Fns) {
  return Object.fromEntries(Object.entries(factories).map(([name, make]) => [name, make(deps)])) as {
    [K in keyof Fns]: ReturnType<Fns[K]>
  }
}

/**
 * Creates effect functions and their registry from evaluator functions.
 * Effects are side effect operations that can be triggered during form processing.
 *
 * @template E - Record of effect evaluator functions
 *
 * @param evaluators - Object mapping effect names to evaluator functions
 *   Each evaluator receives a FormEffectContext and additional arguments
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
  E extends Record<string, (context: FormEffectContext, ...args: ValueExpr[]) => void | Promise<void>>,
>(evaluators: E) {
  const { functions, registry } = defineFunctionSet<FormEffectContext, FunctionType.EFFECT, E>(
    FunctionType.EFFECT,
    evaluators,
  )

  return { effects: functions, registry }
}

/**
 * Creates effect functions with dependency injection from factory functions.
 * This variant allows effects to depend on external services or configuration.
 *
 * @template D - The dependencies type
 * @template Fns - Record of factory functions that create effect evaluators
 *
 * @param deps - Dependencies to inject into the effect factories
 * @param factories - Object mapping effect names to factory functions
 *
 * @returns Same as defineEffects - object with effects builders and registry
 *
 * @example
 * const deps = { emailService: new EmailService(), logger: new Logger() }
 * const { effects, registry } = defineEffectsWithDeps(deps, {
 *   SendEmail: (deps) => (context, recipient: string) => {
 *     return deps.emailService.send(recipient, context.formData)
 *   },
 *   LogAction: (deps) => (context, action: string) => {
 *     deps.logger.info(`${action}: ${context.formId}`)
 *   }
 * })
 */
export function defineEffectsWithDeps<
  D,
  Fns extends Record<string, (deps: D) => (context: FormEffectContext, ...args: ValueExpr[]) => void | Promise<void>>,
>(deps: D, factories: Fns) {
  return defineEffects(withDeps(deps, factories))
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
 * @template D - The dependencies type
 * @template Fns - Record of factory functions that create condition evaluators
 *
 * @param deps - Dependencies to inject into the condition factories
 * @param factories - Object mapping condition names to factory functions
 *
 * @returns Same as defineConditions - object with condition builders and registry
 *
 * @example
 * const deps = { apiClient: new ValidationAPI(), config: { minAge: 18 } }
 * const { conditions, registry } = defineConditionsWithDeps(deps, {
 *   IsValidUser: (deps) => async (userId: string) => {
 *     return deps.apiClient.validateUser(userId)
 *   },
 *   MeetsAgeRequirement: (deps) => (age: number) => {
 *     return age >= deps.config.minAge
 *   }
 * })
 */
export function defineConditionsWithDeps<
  D,
  Fns extends Record<string, (deps: D) => (value: ValueExpr, ...args: ValueExpr[]) => boolean | Promise<boolean>>,
>(deps: D, factories: Fns) {
  return defineConditions(withDeps(deps, factories))
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
 * @template D - The dependencies type
 * @template Fns - Record of factory functions that create transformer evaluators
 *
 * @param deps - Dependencies to inject into the transformer factories
 * @param factories - Object mapping transformer names to factory functions
 *
 * @returns Same as defineTransformers - object with transformer builders and registry
 *
 * @example
 * const deps = {
 *   formatter: new DateFormatter(),
 *   config: { defaultLocale: 'en-US' }
 * }
 * const { transformers, registry } = defineTransformersWithDeps(deps, {
 *   FormatDate: (deps) => (value: Date, format?: string) => {
 *     return deps.formatter.format(value, format, deps.config.defaultLocale)
 *   },
 *   LocalizeNumber: (deps) => (value: number) => {
 *     return value.toLocaleString(deps.config.defaultLocale)
 *   }
 * })
 */
export function defineTransformersWithDeps<
  D,
  Fns extends Record<string, (deps: D) => (value: ValueExpr, ...args: ValueExpr[]) => ValueExpr | Promise<ValueExpr>>,
>(deps: D, factories: Fns) {
  return defineTransformers(withDeps(deps, factories))
}

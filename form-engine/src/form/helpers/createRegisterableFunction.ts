import { FunctionExpr, ValueExpr, ConditionFunctionExpr, TransformerFunctionExpr } from '../types/expressions.type'
import { FunctionType } from '../types/enums'

export type FunctionEvaluator<A extends readonly ValueExpr[], R = any> = (
  value: ValueExpr,
  ...args: A
) => R | Promise<R>

interface RegistryFunction<A extends readonly ValueExpr[], R = any, T extends FunctionExpr<A> = FunctionExpr<A>> {
  (...args: A): T
  spec: {
    name: string
    evaluate: FunctionEvaluator<A, R>
  }
}

/**
 * Make a registerable function that can be added to the form engine.
 * @param type
 * @param name
 * @param evaluator
 */
function createRegisterableFunction<
  A extends readonly ValueExpr[],
  R = any,
  T extends FunctionExpr<A> = FunctionExpr<A>,
>(type: FunctionType, name: string, evaluator: FunctionEvaluator<A, R>): RegistryFunction<A, R, T> {
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
 * Creates a registerable condition function for use in field validation and conditionals/logic predicates.
 * Condition functions evaluate to boolean values and are used to determine validity of form fields
 * or to control conditional logic like field visibility, required states, and transitions.
 *
 * @param name - Unique identifier for the condition function in camelCase (e.g., 'isRequired', 'hasMinLength')
 *               This name is used in the compiled JSON and must be unique within the registry
 *
 * @param evaluator - Function that performs the actual validation
 *                    - First parameter is always the value being validated
 *                    - Additional parameters match the generic type
 *                    - Must return boolean (true = valid, false = invalid)
 *                    - Can be async for operations requiring external validation
 *
 * @returns A registerable function that:
 *          - Can be called with arguments to create a FunctionExpr for use in predicates
 *          - Has a `spec` property containing the name and evaluator for registration
 *
 * @example
 * // Simple condition without parameters
 * const IsRequired = buildConditionFunction(
 *   'isRequired',
 *   (value) => value !== null && value !== undefined && value !== ''
 * )
 *
 * @example
 * // Condition with parameters
 * const HasMinLength = buildConditionFunction(
 *   'hasMinLength',
 *   (value, minLength: number) => {
 *     return typeof value === 'string' && value.length >= minLength
 *   }
 * )
 *
 * @example
 * // Async condition for external validation
 * const IsUniqueEmail = buildConditionFunction(
 *   'isUniqueEmail',
 *   async (value) => {
 *     if (typeof value !== 'string') return false
 *     const response = await checkEmailUniqueness(value)
 *     return response.isUnique
 *   }
 * )
 */
export const buildConditionFunction = <A extends readonly ValueExpr[]>(
  name: string,
  evaluator: FunctionEvaluator<A, boolean>,
) => createRegisterableFunction<A, boolean, ConditionFunctionExpr<A>>(FunctionType.CONDITION, name, evaluator)

/**
 * Creates a registerable transformer function for data transformation in form configurations.
 * Transformer functions modify values and can return any type. They are used to format data,
 * extract information, convert types, or perform any data manipulation needed in the form.
 *
 * @param name - Unique identifier for the transformer function in camelCase (e.g., 'trim', 'toUpperCase')
 *               This name is used in the compiled JSON and must be unique within the registry
 *
 * @param evaluator - Function that performs the actual transformation
 *                    - First parameter is always the value being transformed
 *                    - Additional parameters match the generic type
 *                    - Can return any type (the transformed value)
 *
 * @returns A registrable function that:
 *          - Can be called with arguments to create a FunctionExpr for use in transformations
 *          - Has a `spec` property containing the name and evaluator for registration
 *
 * @example
 * // Simple transformer without parameters
 * const Trim = buildTransformerFunction(
 *   'trim',
 *   (value) => {
 *     return typeof value === 'string' ? value.trim() : value
 *   }
 * )
 *
 * @example
 * // Transformer with parameters
 * const Multiply = buildTransformerFunction(
 *   'multiply',
 *   (value, factor: number) => {
 *     return typeof value === 'number' ? value * factor : value
 *   }
 * )
 */
export const buildTransformerFunction = <A extends readonly ValueExpr[]>(
  name: string,
  evaluator: FunctionEvaluator<A, any>,
) => createRegisterableFunction<A, any, TransformerFunctionExpr<A>>(FunctionType.TRANSFORMER, name, evaluator)

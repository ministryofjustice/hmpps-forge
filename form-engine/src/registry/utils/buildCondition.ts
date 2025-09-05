import { createRegisterableFunction, FunctionEvaluator } from './createRegisterableFunction'
import { ConditionFunctionExpr, ValueExpr } from '../../form/types/expressions.type'
import { FunctionType } from '../../form/types/enums'

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
export const buildConditionFunction = <A extends ValueExpr[]>(name: string, evaluator: FunctionEvaluator<A, boolean>) =>
  createRegisterableFunction<A, boolean, ConditionFunctionExpr<A>>(FunctionType.CONDITION, name, evaluator)

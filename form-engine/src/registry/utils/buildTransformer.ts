import { createRegisterableFunction, FunctionEvaluator } from './createRegisterableFunction'
import { TransformerFunctionExpr, ValueExpr } from '../../form/types/expressions.type'
import { FunctionType } from '../../form/types/enums'

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
export const buildTransformerFunction = <A extends ValueExpr[]>(name: string, evaluator: FunctionEvaluator<A, any>) =>
  createRegisterableFunction<A, any, TransformerFunctionExpr<A>>(FunctionType.TRANSFORMER, name, evaluator)

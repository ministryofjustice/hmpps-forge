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
export const buildEffectFunction = <A extends ValueExpr[]>(
  name: string,
  evaluator: FunctionEvaluator<A>,
): RegistryFunction<A, any, EffectFunctionExpr<A>> =>
  createRegisterableFunction<A, any, EffectFunctionExpr<A>>(FunctionType.EFFECT, name, evaluator)

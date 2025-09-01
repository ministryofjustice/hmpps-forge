import { FunctionExpr, ValueExpr } from '../../form/types/expressions.type'
import { FunctionType } from '../../form/types/enums'

export type FunctionEvaluator<A extends readonly ValueExpr[], R = any> = (
  value: ValueExpr,
  ...args: A
) => R | Promise<R>

export interface RegistryFunction<
  A extends readonly ValueExpr[],
  R = any,
  T extends FunctionExpr<A> = FunctionExpr<A>,
> {
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
export function createRegisterableFunction<
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

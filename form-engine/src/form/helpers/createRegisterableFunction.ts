import { FunctionExpr, ValueExpr } from '../types/expressions.type'

export type FunctionEvaluator<A extends readonly ValueExpr[], R = any> = (
  value: ValueExpr,
  ...args: A
) => R | Promise<R>

interface RegistryFunction<A extends readonly ValueExpr[], R = any> {
  (...args: A): FunctionExpr<A>
  spec: {
    name: string
    evaluate: FunctionEvaluator<A, R>
  }
}

function createRegisterableFunction<A extends readonly ValueExpr[], R = any>(
  name: string,
  evaluator: FunctionEvaluator<A, R>,
): RegistryFunction<A, R> {
  const fn = (...args: A) =>
    ({
      type: 'function',
      name,
      arguments: args,
    }) as FunctionExpr<any>

  ;(fn as RegistryFunction<A, R>).spec = {
    name,
    evaluate: evaluator,
  }

  return fn as RegistryFunction<A, R>
}

export const buildConditionFunction = <A extends readonly ValueExpr[]>(
  name: string,
  evaluator: FunctionEvaluator<A, boolean>,
) => createRegisterableFunction<A, boolean>(name, evaluator)

export const buildTransformerFunction = <A extends readonly ValueExpr[]>(
  name: string,
  evaluator: FunctionEvaluator<A, any>,
) => createRegisterableFunction<A, any>(name, evaluator)

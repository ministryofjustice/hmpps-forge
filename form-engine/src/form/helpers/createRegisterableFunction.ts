import { FunctionExpr, ValueExpr } from '../types/expressions.type'

export type FunctionEvaluator<A extends readonly ValueExpr[]> = (
  value: ValueExpr,
  ...args: A
) => boolean | Promise<boolean>

interface RegistryFunction<A extends readonly ValueExpr[]> {
  (...args: A): FunctionExpr<A>
  spec: {
    name: string
    evaluate: FunctionEvaluator<A>
  }
}

function createRegisterableFunction<A extends readonly ValueExpr[]>(
  name: string,
  evaluator: FunctionEvaluator<A>,
): RegistryFunction<A> {
  const fn = (...args: A) =>
    ({
      type: 'function',
      name,
      arguments: args,
    }) as FunctionExpr<any>

  ;(fn as RegistryFunction<A>).spec = {
    name,
    evaluate: evaluator,
  }

  return fn as RegistryFunction<A>
}

export const buildConditionFunction = createRegisterableFunction

export const buildTransformerFunction = createRegisterableFunction

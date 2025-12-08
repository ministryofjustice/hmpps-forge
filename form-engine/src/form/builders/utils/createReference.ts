import {
  FunctionExpr,
  PipelineExpr,
  PredicateTestExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
} from '../../types/expressions.type'
import { ExpressionType } from '../../types/enums'
import { PredicateTestExprBuilder } from '../PredicateTestExprBuilder'

/**
 * Interface for references that can build predicates and pipelines
 */
export interface BuildableReference extends ReferenceExpr {
  not: PredicateTestExprBuilder
  match(condition: FunctionExpr<any>): PredicateTestExpr
  pipe(...steps: TransformerFunctionExpr[]): PipelineExpr
}

/**
 * Creates a buildable reference using Proxy
 * Appends the PredicateTestExpr fluents and Pipeline fluents onto References
 */
export function createReference<T extends ReferenceExpr>(ref: ReferenceExpr): T {
  const builder = new PredicateTestExprBuilder(ref)

  const pipe = (...steps: TransformerFunctionExpr[]): PipelineExpr => ({
    type: ExpressionType.PIPELINE,
    input: ref,
    steps,
  })

  return new Proxy(ref, {
    get(target, prop) {
      switch (prop) {
        case 'not':
          return builder.not
        case 'match':
          return builder[prop].bind(builder)
        case 'pipe':
          return pipe
        default:
          return target[prop as keyof ReferenceExpr]
      }
    },

    has(target, prop) {
      return prop in target || ['not', 'match', 'pipe'].includes(prop as string)
    },

    ownKeys(target) {
      return Reflect.ownKeys(target)
    },

    getOwnPropertyDescriptor(target, prop) {
      if (['not', 'match', 'pipe'].includes(prop as string)) {
        return undefined
      }

      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
  }) as T
}

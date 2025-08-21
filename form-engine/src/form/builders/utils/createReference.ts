import { FunctionExpr, PredicateTestExpr, ReferenceExpr } from '../../types/expressions.type'
import { PredicateTestExprBuilder } from '../PredicateTestExprBuilder'

/**
 * Interface for references that can build predicates
 */
export interface BuildableReference extends ReferenceExpr {
  readonly not: PredicateTestExprBuilder
  match(condition: FunctionExpr<any>): PredicateTestExpr
}

/**
 * Creates a buildable reference using Proxy
 * Appends the PredicateTextExpr fluents onto References
 * // TODO: Probably need to append Transformer fluents (.pipe) onto this too.
 */
export function createReference<T extends ReferenceExpr>(ref: ReferenceExpr): T {
  const builder = new PredicateTestExprBuilder(ref)

  return new Proxy(ref, {
    get(target, prop) {
      switch (prop) {
        case 'not':
          return builder.not
        case 'match':
          return builder[prop].bind(builder)
        default:
          return target[prop as keyof ReferenceExpr]
      }
    },

    has(target, prop) {
      return prop in target || ['not', 'match'].includes(prop as string)
    },

    ownKeys(target) {
      return Reflect.ownKeys(target)
    },

    getOwnPropertyDescriptor(target, prop) {
      if (['not', 'match'].includes(prop as string)) {
        return undefined
      }
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
  }) as T
}

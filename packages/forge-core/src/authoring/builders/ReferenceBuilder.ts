import { ReferenceExpr } from '../types/expressions.type'
import { ExpressionType, BuilderType } from '../types/enums'
import { ChainedValueBuilder } from './ExpressionBuilder'
import { splitKey } from './utils/splitKey'

/**
 * Immutable builder for ReferenceExpr with path navigation support.
 *
 * Extends the base expression builder pattern with:
 * - .path(key) for nested property access
 *
 * @example
 * Data('user').path('address.city')  // path: ['data', 'user', 'address', 'city']
 * Answer('email').pipe(Transformer.String.Trim).match(Condition.IsRequired())
 *
 * @internal Exposed to authors via the ChainableRef interface.
 */
export class ReferenceBuilder extends ChainedValueBuilder<ReferenceExpr> {
  readonly _forge = BuilderType.REFERENCE as const

  private constructor(ref: ReferenceExpr, negate: boolean) {
    super(ref, negate)
  }

  /**
   * Create a builder from path segments.
   */
  static create(path: string[]): ReferenceBuilder {
    return new ReferenceBuilder(
      {
        _forge: ExpressionType.REFERENCE,
        path,
      },
      false,
    )
  }

  /**
   * Navigate to a nested property.
   * Supports dot notation: .path('user.address.city')
   *
   * @example
   * Data('response').path('data.items')
   * Answer('user').path('address').path('postcode')
   */
  path(key: string): ReferenceBuilder {
    const newRef: ReferenceExpr = {
      _forge: ExpressionType.REFERENCE,
      path: [...this.expression.path, ...splitKey(key)],
    }

    return new ReferenceBuilder(newRef, false)
  }

  /**
   * Negate the next condition test.
   * Returns a new builder with toggled negation.
   *
   * @example
   * Self().not.match(Condition.IsRequired())  // negate: true
   * Answer('x').not.not.match(...)  // negate: false (double negation)
   */
  get not(): ReferenceBuilder {
    return new ReferenceBuilder(this.expression, !this.negated)
  }
}

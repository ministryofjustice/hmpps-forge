import {
  ConditionFunctionExpr,
  IteratorConfig,
  PipelineExpr,
  PredicateTestExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
} from '../types/expressions.type'
import { ExpressionType, LogicType } from '../types/enums'
import { ExpressionBuilder } from './ExpressionBuilder'
import { IterableBuilder } from './IterableBuilder'

/**
 * Split a key string into path segments.
 * 'user.name' -> ['user', 'name']
 * 'simple' -> ['simple']
 */
const splitKey = (key: string): string[] => (key.includes('.') ? key.split('.') : [key])

/**
 * Immutable builder for ReferenceExpr with path navigation support.
 *
 * Extends the base expression builder pattern with:
 * - .path(key) for nested property access
 *
 * @example
 * Data('user').path('address.city')  // path: ['data', 'user', 'address', 'city']
 * Answer('email').pipe(Transformer.String.Trim).match(Condition.IsRequired())
 */
export class ReferenceBuilder {
  private readonly reference: ReferenceExpr

  private readonly negated: boolean

  private constructor(ref: ReferenceExpr, negate: boolean) {
    this.reference = ref
    this.negated = negate
  }

  /**
   * Create a builder from path segments.
   */
  static create(path: string[]): ReferenceBuilder {
    return new ReferenceBuilder(
      {
        type: ExpressionType.REFERENCE,
        path,
      },
      false,
    )
  }

  /**
   * Get the underlying reference expression.
   */
  get expr(): ReferenceExpr {
    return this.reference
  }

  /**
   * Build the final reference expression.
   * Called automatically by finaliseBuilders().
   */
  build(): ReferenceExpr {
    return this.reference
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
      type: ExpressionType.REFERENCE,
      path: [...this.reference.path, ...splitKey(key)],
    }

    return new ReferenceBuilder(newRef, false)
  }

  /**
   * Transform through a pipeline of transformers.
   * Returns an ExpressionBuilder wrapping the PipelineExpr.
   *
   * @example
   * Answer('email').pipe(Transformer.String.Trim, Transformer.String.ToLowerCase)
   */
  pipe(...steps: TransformerFunctionExpr[]): ExpressionBuilder<PipelineExpr> {
    return ExpressionBuilder.pipeline(this.reference, steps)
  }

  /**
   * Enter per-item iteration mode with an iterator.
   * Returns an IterableBuilder that can chain more .each() calls or exit via .pipe().
   *
   * @example
   * Data('items').each(Iterator.Map({ label: Item().path('name') }))
   * Data('items').each(Iterator.Filter(...)).each(Iterator.Map(...))
   */
  each(iterator: IteratorConfig): IterableBuilder {
    return IterableBuilder.create(this.reference, iterator)
  }

  /**
   * Test against a condition.
   * Terminal operation - returns a plain PredicateTestExpr.
   *
   * @example
   * Answer('email').match(Condition.Email.IsValid())
   * Self().not.match(Condition.IsRequired())
   */
  match(condition: ConditionFunctionExpr<any>): PredicateTestExpr {
    return {
      type: LogicType.TEST,
      subject: this.reference,
      negate: this.negated,
      condition,
    }
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
    return new ReferenceBuilder(this.reference, !this.negated)
  }
}

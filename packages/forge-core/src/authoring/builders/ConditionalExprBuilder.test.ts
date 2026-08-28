import { Answer, Self } from './index'
import { ConditionalExprBuilder, when } from './ConditionalExprBuilder'
import { finaliseBuilders } from './utils/finaliseBuilders'
import { ConditionalExpr, PredicateTestExpr } from '../types/expressions.type'
import { Condition } from '../../built-ins/functions/conditions'
import { FunctionCallType, ExpressionType, PredicateType } from '../../shared/taxonomy'

describe('ConditionalExprBuilder', () => {
  const simplePredicate = () => Self().match(Condition.IsRequired())

  describe('when()', () => {
    it('creates a ConditionalExprBuilder instance', () => {
      const builder = when(simplePredicate())
      expect(builder).toBeInstanceOf(ConditionalExprBuilder)
    })

    it('accepts a PredicateExpr', () => {
      const predicate = simplePredicate()
      const builder = when(predicate)
      expect(builder).toBeDefined()
    })

    it('accepts a PredicateTestExpr directly', () => {
      const testExpr: PredicateTestExpr = {
        _forge: PredicateType.TEST,
        subject: { _forge: ExpressionType.REFERENCE, path: ['@self'] },
        negate: false,
        condition: { _forge: FunctionCallType.CONDITION, name: 'isRequired', arguments: [] },
      }

      const builder = when(testExpr)
      expect(builder).toBeDefined()
    })
  })

  describe('then()', () => {
    it('sets the then value and returns a new builder', () => {
      // Arrange
      const builder = when(simplePredicate())

      // Act
      const result = builder.then('Success')

      // Assert
      expect(result).not.toBe(builder)
      expect(result).toBeInstanceOf(ConditionalExprBuilder)
    })

    it('accepts string values', () => {
      const result = finaliseBuilders(when(simplePredicate()).then('String value')) as ConditionalExpr

      expect(result.thenValue).toBe('String value')
    })

    it('accepts ResolvableValue references', () => {
      const valueExpr = Answer('someField')
      const result = finaliseBuilders(when(simplePredicate()).then(valueExpr)) as ConditionalExpr

      // After finaliseBuilders, the ReferenceBuilder is converted to a ReferenceExpr
      expect(result.thenValue).toEqual({
        _forge: ExpressionType.REFERENCE,
        path: ['answers', 'someField'],
      })
    })
  })

  describe('else()', () => {
    it('sets the else value and returns a new builder', () => {
      // Arrange
      const builder = when(simplePredicate())

      // Act
      const result = builder.else('Failure')

      // Assert
      expect(result).not.toBe(builder)
      expect(result).toBeInstanceOf(ConditionalExprBuilder)
    })

    it('leaves the original builder unchanged when forked', () => {
      // Arrange
      const base = when(simplePredicate()).then('Yes')

      // Act
      const a = finaliseBuilders(base.else('A')) as ConditionalExpr
      const b = finaliseBuilders(base.else('B')) as ConditionalExpr

      // Assert
      expect(a.elseValue).toBe('A')
      expect(b.elseValue).toBe('B')
    })

    it('accepts string values', () => {
      const result = finaliseBuilders(when(simplePredicate()).else('Error message')) as ConditionalExpr

      expect(result.elseValue).toBe('Error message')
    })

    it('accepts ResolvableValue references', () => {
      const valueExpr = Answer('fallbackField')
      const result = finaliseBuilders(when(simplePredicate()).else(valueExpr)) as ConditionalExpr

      // After finaliseBuilders, the ReferenceBuilder is converted to a ReferenceExpr
      expect(result.elseValue).toEqual({
        _forge: ExpressionType.REFERENCE,
        path: ['answers', 'fallbackField'],
      })
    })
  })

  describe('build()', () => {
    it('creates a complete ConditionalExpr', () => {
      const predicate = simplePredicate()
      const result = finaliseBuilders(when(predicate).then('Yes').else('No')) as ConditionalExpr

      expect(result).toEqual({
        _forge: ExpressionType.CONDITIONAL,
        predicate,
        thenValue: 'Yes',
        elseValue: 'No',
      })
    })

    it('defaults thenValue to true when not specified', () => {
      const result = finaliseBuilders(when(simplePredicate()).else('No')) as ConditionalExpr

      expect(result.thenValue).toBe(true)
    })

    it('defaults elseValue to false when not specified', () => {
      const result = finaliseBuilders(when(simplePredicate()).then('Yes')) as ConditionalExpr

      expect(result.elseValue).toBe(false)
    })

    it('uses both defaults when neither branch is specified', () => {
      const result = finaliseBuilders(when(simplePredicate())) as ConditionalExpr

      expect(result.thenValue).toBe(true)
      expect(result.elseValue).toBe(false)
    })
  })
})

import { Answer, Self } from '@form-engine/form/builders/index'
import { ConditionalExprBuilder, when } from './ConditionalExprBuilder'
import { finaliseBuilders } from './utils/finaliseBuilders'
import { ConditionalExpr, PredicateTestExpr } from '../types/expressions.type'
import { Condition } from '../../registry/conditions'
import { FunctionType, ExpressionType, LogicType } from '../types/enums'

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
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'isRequired', arguments: [] },
      }

      const builder = when(testExpr)
      expect(builder).toBeDefined()
    })
  })

  describe('then()', () => {
    it('sets the then value and returns the builder', () => {
      const builder = when(simplePredicate())
      const result = builder.then('Success')

      expect(result).toBe(builder) // Fluent interface
      expect(result).toBeInstanceOf(ConditionalExprBuilder)
    })

    it('accepts string values', () => {
      const result = finaliseBuilders(when(simplePredicate()).then('String value')) as ConditionalExpr

      expect(result.thenValue).toBe('String value')
    })

    it('accepts ValueExpr references', () => {
      const valueExpr = Answer('someField')
      const result = finaliseBuilders(when(simplePredicate()).then(valueExpr)) as ConditionalExpr

      expect(result.thenValue).toBe(valueExpr)
    })
  })

  describe('else()', () => {
    it('sets the else value and returns the builder', () => {
      const builder = when(simplePredicate())
      const result = builder.else('Failure')

      expect(result).toBe(builder) // Fluent interface
      expect(result).toBeInstanceOf(ConditionalExprBuilder)
    })

    it('accepts string values', () => {
      const result = finaliseBuilders(when(simplePredicate()).else('Error message')) as ConditionalExpr

      expect(result.elseValue).toBe('Error message')
    })

    it('accepts ValueExpr references', () => {
      const valueExpr = Answer('fallbackField')
      const result = finaliseBuilders(when(simplePredicate()).else(valueExpr)) as ConditionalExpr

      expect(result.elseValue).toBe(valueExpr)
    })
  })

  describe('build()', () => {
    it('creates a complete ConditionalExpr', () => {
      const predicate = simplePredicate()
      const result = finaliseBuilders(when(predicate).then('Yes').else('No')) as ConditionalExpr

      expect(result).toEqual({
        type: LogicType.CONDITIONAL,
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

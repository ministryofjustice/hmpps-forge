import {
  isConditionAndExpr,
  isConditionCombinatorExpr,
  isConditionNotExpr,
  isConditionOrExpr,
  isConditionXorExpr,
} from './conditionCombinators'
import { ConditionCombinatorType, FunctionType, PredicateType } from '../types/enums'

describe('conditionCombinators', () => {
  const condition = { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A'] }
  const conditionAnd = { type: ConditionCombinatorType.AND, operands: [condition, condition] }
  const conditionOr = { type: ConditionCombinatorType.OR, operands: [condition, condition] }
  const conditionXor = { type: ConditionCombinatorType.XOR, operands: [condition, condition] }
  const conditionNot = { type: ConditionCombinatorType.NOT, operand: condition }
  const predicateAnd = { type: PredicateType.AND, operands: [condition, condition] }

  const nonCombinators = [null, undefined, condition, predicateAnd]

  describe('isConditionAndExpr()', () => {
    it('should return true when given an AND condition combinator', () => {
      // Arrange & Act & Assert
      expect(isConditionAndExpr(conditionAnd)).toBe(true)
    })

    it('should return false when given any other combinator, condition, predicate or nullish value', () => {
      // Arrange
      const others = [conditionOr, conditionXor, conditionNot, ...nonCombinators]

      // Act
      const results = others.map(isConditionAndExpr)

      // Assert
      expect(results).not.toContain(true)
    })
  })

  describe('isConditionOrExpr()', () => {
    it('should return true when given an OR condition combinator', () => {
      // Arrange & Act & Assert
      expect(isConditionOrExpr(conditionOr)).toBe(true)
    })

    it('should return false when given any other combinator, condition, predicate or nullish value', () => {
      // Arrange
      const others = [conditionAnd, conditionXor, conditionNot, ...nonCombinators]

      // Act
      const results = others.map(isConditionOrExpr)

      // Assert
      expect(results).not.toContain(true)
    })
  })

  describe('isConditionXorExpr()', () => {
    it('should return true when given an XOR condition combinator', () => {
      // Arrange & Act & Assert
      expect(isConditionXorExpr(conditionXor)).toBe(true)
    })

    it('should return false when given any other combinator, condition, predicate or nullish value', () => {
      // Arrange
      const others = [conditionAnd, conditionOr, conditionNot, ...nonCombinators]

      // Act
      const results = others.map(isConditionXorExpr)

      // Assert
      expect(results).not.toContain(true)
    })
  })

  describe('isConditionNotExpr()', () => {
    it('should return true when given a NOT condition combinator', () => {
      // Arrange & Act & Assert
      expect(isConditionNotExpr(conditionNot)).toBe(true)
    })

    it('should return false when given any other combinator, condition, predicate or nullish value', () => {
      // Arrange
      const others = [conditionAnd, conditionOr, conditionXor, ...nonCombinators]

      // Act
      const results = others.map(isConditionNotExpr)

      // Assert
      expect(results).not.toContain(true)
    })
  })

  describe('isConditionCombinatorExpr()', () => {
    it('should return true when given any of the four condition combinators', () => {
      // Arrange
      const combinators = [conditionAnd, conditionOr, conditionXor, conditionNot]

      // Act
      const results = combinators.map(isConditionCombinatorExpr)

      // Assert
      expect(results).not.toContain(false)
    })

    it('should return false when given a condition, predicate or nullish value', () => {
      // Arrange & Act
      const results = nonCombinators.map(isConditionCombinatorExpr)

      // Assert
      expect(results).not.toContain(true)
    })
  })
})

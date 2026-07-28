import { Answer, Data, Item } from './index'
import { MatchExprBuilder, match } from './MatchExprBuilder'
import { and, not, or } from './PredicateTestExprBuilder'
import { finaliseBuilders } from './utils/finaliseBuilders'
import { MatchExpr } from '../types/expressions.type'
import { Condition } from '../conditions'
import { ConditionCombinatorType, ExpressionType, FunctionType } from '../types/enums'

describe('MatchExprBuilder', () => {
  describe('match()', () => {
    it('should create a MatchExprBuilder instance', () => {
      // Arrange & Act
      const builder = match(Data('status'))

      // Assert
      expect(builder).toBeInstanceOf(MatchExprBuilder)
    })

    it('should accept a string subject', () => {
      // Arrange & Act
      const builder = match('literal')

      // Assert
      expect(builder).toBeDefined()
    })
  })

  describe('branch()', () => {
    it('should return the builder for chaining', () => {
      // Arrange
      const builder = match(Data('status'))

      // Act
      const result = builder.branch(Condition.Equals('ACTIVE'), 'Active')

      // Assert
      expect(result).toBe(builder)
      expect(result).toBeInstanceOf(MatchExprBuilder)
    })

    it('should accept string values', () => {
      // Arrange & Act
      const result = finaliseBuilders(match(Data('status')).branch(Condition.Equals('ACTIVE'), 'Active')) as MatchExpr

      // Assert
      expect(result.branches[0].value).toBe('Active')
    })

    it('should accept ResolvableValue references', () => {
      // Arrange
      const valueExpr = Answer('someField')

      // Act
      const result = finaliseBuilders(match(Data('status')).branch(Condition.Equals('ACTIVE'), valueExpr)) as MatchExpr

      // Assert
      expect(result.branches[0].value).toEqual({
        type: ExpressionType.REFERENCE,
        path: ['answers', 'someField'],
      })
    })

    it('should accept a condition combinator tree', () => {
      // Arrange
      const builder = match(Data('status'))

      // Act
      const result = builder.branch(or(Condition.Equals('ACTIVE'), Condition.Equals('PENDING')), 'Open')

      // Assert
      expect(result).toBe(builder)
    })
  })

  describe('otherwise()', () => {
    it('should return the builder for chaining', () => {
      // Arrange
      const builder = match(Data('status'))

      // Act
      const result = builder.otherwise('Unknown')

      // Assert
      expect(result).toBe(builder)
      expect(result).toBeInstanceOf(MatchExprBuilder)
    })

    it('should accept string values', () => {
      // Arrange & Act
      const result = finaliseBuilders(
        match(Data('status')).branch(Condition.Equals('A'), 'A').otherwise('Default'),
      ) as MatchExpr

      // Assert
      expect(result.otherwise).toBe('Default')
    })

    it('should accept ResolvableValue references', () => {
      // Arrange
      const valueExpr = Answer('fallbackField')

      // Act
      const result = finaliseBuilders(
        match(Data('status')).branch(Condition.Equals('A'), 'A').otherwise(valueExpr),
      ) as MatchExpr

      // Assert
      expect(result.otherwise).toEqual({
        type: ExpressionType.REFERENCE,
        path: ['answers', 'fallbackField'],
      })
    })
  })

  describe('build()', () => {
    it('should create a complete MatchExpr with multiple branches', () => {
      // Arrange & Act
      const result = finaliseBuilders(
        match(Data('type'))
          .branch(Condition.Equals('A'), 'Result A')
          .branch(Condition.Equals('B'), 'Result B')
          .branch(Condition.Equals('C'), 'Result C')
          .otherwise('Default'),
      ) as MatchExpr

      // Assert
      expect(result).toEqual({
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A'] },
            value: 'Result A',
          },
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['B'] },
            value: 'Result B',
          },
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['C'] },
            value: 'Result C',
          },
        ],
        otherwise: 'Default',
      })
    })

    it('should omit otherwise when not set', () => {
      // Arrange & Act
      const result = finaliseBuilders(match(Data('type')).branch(Condition.Equals('A'), 'Result A')) as MatchExpr

      // Assert
      expect(result.otherwise).toBeUndefined()
    })

    it('should finalise builder references in subject', () => {
      // Arrange & Act
      const result = finaliseBuilders(
        match(Item().path('status')).branch(Condition.Equals('ACTIVE'), 'Active'),
      ) as MatchExpr

      // Assert
      expect(result.subject).toEqual({
        type: ExpressionType.REFERENCE,
        path: ['@scope', '0', 'status'],
      })
    })

    it('should carry a condition combinator tree through to the branch', () => {
      // Arrange
      const condition = or(and(Condition.Equals('A'), Condition.Equals('B')), not(Condition.Equals('C')))

      // Act
      const result = finaliseBuilders(match(Data('status')).branch(condition, 'Matched')) as MatchExpr

      // Assert
      expect(result.branches[0].condition).toEqual({
        type: ConditionCombinatorType.OR,
        operands: [
          {
            type: ConditionCombinatorType.AND,
            operands: [
              { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A'] },
              { type: FunctionType.CONDITION, name: 'Equals', arguments: ['B'] },
            ],
          },
          {
            type: ConditionCombinatorType.NOT,
            operand: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['C'] },
          },
        ],
      })
    })

    it('should create a single-branch match expression', () => {
      // Arrange & Act
      const result = finaliseBuilders(
        match(Data('status')).branch(Condition.Equals('ACTIVE'), 'Active').otherwise('Inactive'),
      ) as MatchExpr

      // Assert
      expect(result.branches).toHaveLength(1)
      expect(result.branches[0].value).toBe('Active')
      expect(result.otherwise).toBe('Inactive')
    })
  })
})

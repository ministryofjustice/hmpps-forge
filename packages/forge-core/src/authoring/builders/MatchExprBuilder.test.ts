import { Answer, Data, Item } from './index'
import { MatchExprBuilder, match } from './MatchExprBuilder'
import { and, not, or } from './combinators'
import { finaliseBuilders } from './utils/finaliseBuilders'
import { MatchExpr } from '../types/expressions.type'
import { Condition } from '../../built-ins/functions/conditions'
import { ConditionCombinatorType, ExpressionType, FunctionCallType } from '../types/enums'

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
    it('should return a new builder for chaining', () => {
      // Arrange
      const builder = match(Data('status'))

      // Act
      const result = builder.branch(Condition.Equals('ACTIVE'), 'Active')

      // Assert
      expect(result).not.toBe(builder)
      expect(result).toBeInstanceOf(MatchExprBuilder)
    })

    it('should leave the original builder unchanged when forked', () => {
      // Arrange
      const base = match(Data('status')).branch(Condition.Equals('A'), 'A')

      // Act
      const forked = finaliseBuilders(base.branch(Condition.Equals('B'), 'B')) as MatchExpr
      const original = finaliseBuilders(base) as MatchExpr

      // Assert
      expect(forked.branches).toHaveLength(2)
      expect(original.branches).toHaveLength(1)
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
        _forge: ExpressionType.REFERENCE,
        path: ['answers', 'someField'],
      })
    })

    it('should accept a condition combinator tree', () => {
      // Arrange
      const builder = match(Data('status'))

      // Act
      const result = builder.branch(or(Condition.Equals('ACTIVE'), Condition.Equals('PENDING')), 'Open')

      // Assert
      expect(result).toBeInstanceOf(MatchExprBuilder)
    })
  })

  describe('otherwise()', () => {
    it('should return a new builder for chaining', () => {
      // Arrange
      const builder = match(Data('status'))

      // Act
      const result = builder.otherwise('Unknown')

      // Assert
      expect(result).not.toBe(builder)
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
        _forge: ExpressionType.REFERENCE,
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
        _forge: ExpressionType.MATCH,
        subject: { _forge: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['A'] },
            value: 'Result A',
          },
          {
            condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['B'] },
            value: 'Result B',
          },
          {
            condition: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['C'] },
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
        _forge: ExpressionType.REFERENCE,
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
        _forge: ConditionCombinatorType.OR,
        operands: [
          {
            _forge: ConditionCombinatorType.AND,
            operands: [
              { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['A'] },
              { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['B'] },
            ],
          },
          {
            _forge: ConditionCombinatorType.NOT,
            operand: { _forge: FunctionCallType.CONDITION, name: 'Equals', arguments: ['C'] },
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

import { Answer, Data, Item } from '@form-engine/form/builders/index'
import { MatchExprBuilder, match } from './MatchExprBuilder'
import { finaliseBuilders } from './utils/finaliseBuilders'
import { MatchExpr } from '../types/expressions.type'
import { Condition } from '../../registry/conditions'
import { ExpressionType, FunctionType } from '../types/enums'

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

    it('should accept ValueExpr references', () => {
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

    it('should accept ValueExpr references', () => {
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

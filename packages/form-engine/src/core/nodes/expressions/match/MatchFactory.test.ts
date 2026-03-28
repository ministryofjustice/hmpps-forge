import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import { MatchASTNode } from '@form-engine/core/types/expressions.type'
import type { MatchExpr, ValueExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { TestPredicateASTNode } from '@form-engine/core/types/predicates.type'
import MatchFactory from './MatchFactory'

describe('MatchFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let matchFactory: MatchFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    matchFactory = new MatchFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Match expression with all properties', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['ACTIVE' as ValueExpr] },
            value: 'Active',
          },
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['CLOSED' as ValueExpr] },
            value: 'Closed',
          },
        ],
        otherwise: 'Unknown',
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json) as MatchASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.MATCH)
      expect(result.raw).toBe(json)
      expect(result.properties.branches).toHaveLength(2)
      expect(result.properties.otherwise).toBe('Unknown')
    })

    it('should synthesise predicates for each branch', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ValueExpr] },
            value: 'Result A',
          },
        ],
        otherwise: 'Default',
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)
      const predicate = result.properties.branches[0].predicate as TestPredicateASTNode

      // Assert
      expect(predicate.type).toBe(ASTNodeType.PREDICATE)
      expect(predicate.predicateType).toBe(PredicateType.TEST)
    })

    it('should handle literal branch values', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ValueExpr] },
            value: 'literalValue',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.branches[0].value).toBe('literalValue')
    })

    it('should transform expression branch values', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ValueExpr] },
            value: { type: ExpressionType.REFERENCE, path: ['answers', 'fieldA'] },
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.branches[0].value.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle otherwise when present', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ValueExpr] },
            value: 'A',
          },
        ],
        otherwise: 'Default',
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.otherwise).toBe('Default')
    })

    it('should handle missing otherwise', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ValueExpr] },
            value: 'A',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.otherwise).toBeUndefined()
    })

    it('should transform expression otherwise value', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ValueExpr] },
            value: 'A',
          },
        ],
        otherwise: { type: ExpressionType.REFERENCE, path: ['answers', 'fallback'] },
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.otherwise.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ValueExpr] },
            value: 'A',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result1 = matchFactory.create(json)
      const result2 = matchFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should throw InvalidNodeError when subject is missing', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A'] },
            value: 'A',
          },
        ],
      } as any

      // Act & Assert
      expect(() => matchFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => matchFactory.create(json)).toThrow('Match expression requires a subject')
    })

    it('should throw InvalidNodeError when branches is empty', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [],
      } as any

      // Act & Assert
      expect(() => matchFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => matchFactory.create(json)).toThrow('Match expression requires at least one branch')
    })

    it('should throw InvalidNodeError when branches is missing', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
      } as any

      // Act & Assert
      expect(() => matchFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => matchFactory.create(json)).toThrow('Match expression requires at least one branch')
    })
  })
})

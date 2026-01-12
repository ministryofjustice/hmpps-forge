import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import type { PredicateTestExpr, ValueExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import TestFactory from './TestFactory'

describe('TestFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let testFactory: TestFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    testFactory = new TestFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Test predicate with subject and condition', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.PREDICATE)
      expect(result.predicateType).toBe(PredicateType.TEST)
      expect(result.raw).toBe(json)
      expect(result.properties.subject).toBeDefined()
      expect(result.properties.condition).toBeDefined()
      expect(result.properties.negate).toBeDefined()
    })

    it('should transform subject using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)
      const subject = result.properties.subject as ExpressionASTNode

      // Assert
      expect(subject.type).toBe(ASTNodeType.EXPRESSION)
      expect(subject.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should transform condition using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)
      const condition = result.properties.condition as ExpressionASTNode

      // Assert
      expect(condition.type).toBe(ASTNodeType.EXPRESSION)
      expect(condition.expressionType).toBe(FunctionType.CONDITION)
    })

    it('should handle negate flag as true', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: true,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)

      // Assert
      expect(result.properties.negate).toBe(true)
    })

    it('should handle negate flag as false', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)

      // Assert
      expect(result.properties.negate).toBe(false)
    })

    it('should default negate to false when omitted', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      }

      // Act
      const result = testFactory.create(json as PredicateTestExpr)

      // Assert
      expect(result.properties.negate).toBe(false)
    })

    it('should throw InvalidNodeError when subject is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } as any

      // Act & Assert
      expect(() => testFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => testFactory.create(json)).toThrow('Test predicate requires a subject')
    })

    it('should throw InvalidNodeError when condition is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
      } as any

      // Act & Assert
      expect(() => testFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => testFactory.create(json)).toThrow('Test predicate requires a condition')
    })

    it('should support literal string as subject', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: 'hello' as any,
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)

      // Assert
      expect(result.properties.subject).toBe('hello')
    })

    it('should support literal number as subject', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: 42 as any,
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'GreaterThan', arguments: [0] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)

      // Assert
      expect(result.properties.subject).toBe(42)
    })

    it('should support literal array as subject', () => {
      // Arrange
      const literalArray = [1, 2, 3]
      const json = {
        type: PredicateType.TEST,
        subject: literalArray as any,
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'HasLength', arguments: [3] as ValueExpr[] },
      } satisfies PredicateTestExpr

      // Act
      const result = testFactory.create(json)

      // Assert
      expect(result.properties.subject).toEqual([1, 2, 3])
    })
  })
})

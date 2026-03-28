import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import { ConditionalASTNode } from '@form-engine/core/types/expressions.type'
import type { ConditionalExpr, PredicateTestExpr, ValueExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { TestPredicateASTNode } from '@form-engine/core/types/predicates.type'
import ConditionalFactory from './ConditionalFactory'

describe('ConditionalFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let conditionalFactory: ConditionalFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    conditionalFactory = new ConditionalFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Conditional expression with all properties', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      // Act
      const result = conditionalFactory.create(json) as ConditionalASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.CONDITIONAL)
      expect(result.raw).toBe(json)
      expect(result.properties.predicate).toBeDefined()
      expect(result.properties.thenValue).toBeDefined()
      expect(result.properties.elseValue).toBeDefined()
    })

    it('should transform predicate using nodeFactory', () => {
      // Arrange
      const predicateJson = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: predicateJson,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      // Act
      const result = conditionalFactory.create(json)
      const predicate = result.properties.predicate as TestPredicateASTNode

      // Assert
      expect(predicate.type).toBe(ASTNodeType.PREDICATE)
      expect(predicate.predicateType).toBe(PredicateType.TEST)
    })

    it('should handle literal thenValue and elseValue', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'literalThen',
        elseValue: 'literalElse',
      } satisfies ConditionalExpr

      // Act
      const result = conditionalFactory.create(json)

      // Assert
      expect(result.properties.thenValue).toBe('literalThen')
      expect(result.properties.elseValue).toBe('literalElse')
    })

    it('should transform expression thenValue and elseValue', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: { type: ExpressionType.REFERENCE, path: ['answers', 'thenField'] },
        elseValue: { type: ExpressionType.REFERENCE, path: ['answers', 'elseField'] },
      } satisfies ConditionalExpr

      // Act
      const result = conditionalFactory.create(json)

      // Assert
      expect(result.properties.thenValue.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.elseValue.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should default thenValue to true when omitted', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        elseValue: 'no',
      }

      // Act
      const result = conditionalFactory.create(json as ConditionalExpr)

      // Assert
      expect(result.properties.predicate).toBeDefined()
      expect(result.properties.thenValue).toBe(true)
      expect(result.properties.elseValue).toBe('no')
    })

    it('should default elseValue to false when omitted', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
      }

      // Act
      const result = conditionalFactory.create(json as ConditionalExpr)

      // Assert
      expect(result.properties.predicate).toBeDefined()
      expect(result.properties.thenValue).toBe('yes')
      expect(result.properties.elseValue).toBe(false)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      // Act
      const result1 = conditionalFactory.create(json)
      const result2 = conditionalFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should throw InvalidNodeError when predicate is missing', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        thenValue: 'yes',
        elseValue: 'no',
      } as any

      // Act & Assert
      expect(() => conditionalFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => conditionalFactory.create(json)).toThrow('Conditional expression requires a predicate')
    })
  })
})

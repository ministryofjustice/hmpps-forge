import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, IteratorType, PredicateType } from '@form-engine/form/types/enums'
import type { IterateExpr, PredicateTestExpr, ReferenceExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import IterateFactory from './IterateFactory'

describe('IterateFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let iterateFactory: IterateFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    iterateFactory = new IterateFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create an Iterate expression with MAP iterator', () => {
      // Arrange
      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['scope', 'item', 'name'] },
        },
      } satisfies IterateExpr

      // Act
      const result = iterateFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.ITERATE)
      expect(result.raw).toBe(json)

      expect(result.properties.input).toBeDefined()
      expect(result.properties.iterator.type).toBe(IteratorType.MAP)
      expect(result.properties.iterator.yield).toBeDefined()
    })

    it('should create an Iterate expression with FILTER iterator', () => {
      // Arrange
      const predicate: PredicateTestExpr = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['scope', 'item', 'active'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: [true] },
      }

      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.FILTER,
          predicate,
        },
      } satisfies IterateExpr

      // Act
      const result = iterateFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.ITERATE)

      expect(result.properties.iterator.type).toBe(IteratorType.FILTER)
      expect(result.properties.iterator.predicate).toBeDefined()
    })

    it('should create an Iterate expression with FIND iterator', () => {
      // Arrange
      const predicate: PredicateTestExpr = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['scope', 'item', 'id'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
      }

      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.FIND,
          predicate,
        },
      } satisfies IterateExpr

      // Act
      const result = iterateFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.ITERATE)

      expect(result.properties.iterator.type).toBe(IteratorType.FIND)
      expect(result.properties.iterator.predicate).toBeDefined()
    })

    it('should transform input expression', () => {
      // Arrange
      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['data', 'collection'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['scope', 'item'] },
        },
      } satisfies IterateExpr

      // Act
      const result = iterateFactory.create(json)

      // Assert
      expect(result.properties.input).toHaveProperty('id')
      expect(result.properties.input.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.input.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should store yield template as raw JSON for MAP iterator', () => {
      // Arrange
      const yieldTemplate = { type: ExpressionType.REFERENCE, path: ['scope', 'item', 'value'] }
      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.MAP,
          yield: yieldTemplate,
        },
      } satisfies IterateExpr

      // Act
      const result = iterateFactory.create(json)

      // Assert - yield should be stored as raw JSON, not transformed
      expect(result.properties.iterator.yield).toEqual(yieldTemplate)
      expect(result.properties.iterator.yield).not.toHaveProperty('id')
    })

    it('should store predicate template as raw JSON for FILTER iterator', () => {
      // Arrange
      const predicateTemplate: PredicateTestExpr = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['scope', 'item', 'active'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: [true] },
      }

      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.FILTER,
          predicate: predicateTemplate,
        },
      } satisfies IterateExpr

      // Act
      const result = iterateFactory.create(json)

      // Assert - predicate should be stored as raw JSON, not transformed
      expect(result.properties.iterator.predicate).toEqual(predicateTemplate)
      expect(result.properties.iterator.predicate).not.toHaveProperty('id')
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.MAP,
          yield: { type: ExpressionType.REFERENCE, path: ['scope', 'item'] },
        },
      } satisfies IterateExpr

      // Act
      const result1 = iterateFactory.create(json)
      const result2 = iterateFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})

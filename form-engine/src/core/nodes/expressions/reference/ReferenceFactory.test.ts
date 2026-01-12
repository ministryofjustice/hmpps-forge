import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import type { ReferenceExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import ReferenceFactory from './ReferenceFactory'

describe('ReferenceFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let referenceFactory: ReferenceFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    referenceFactory = new ReferenceFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Reference expression with simple path', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['answers', 'field'],
      } satisfies ReferenceExpr

      // Act
      const result = referenceFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.REFERENCE)
      expect(result.properties.path).toBeDefined()

      const path = result.properties.path
      expect(Array.isArray(path)).toBe(true)
      expect(path).toEqual(['answers', 'field'])

      expect(result.raw).toBe(json)
    })

    it('should transform path segments that are expressions', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['items', { type: ExpressionType.REFERENCE, path: ['scope', 'index'] }],
      } as ReferenceExpr

      // Act
      const result = referenceFactory.create(json)

      // Assert
      const path = result.properties.path
      expect(Array.isArray(path)).toBe(true)
      expect(path).toHaveLength(2)
      expect(path[0]).toBe('items')

      // Second segment should be transformed to an AST node
      expect(path[1]).toHaveProperty('id')
      expect(path[1]).toHaveProperty('type')
      expect((path[1] as ExpressionASTNode).type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should throw error for non-array path values', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: 'simpleString',
      }

      // Act & Assert
      expect(() => referenceFactory.create(json as any)).toThrow('Reference path must be a non-empty array')
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['answers', 'field'],
      } satisfies ReferenceExpr

      // Act
      const result1 = referenceFactory.create(json)
      const result2 = referenceFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should not modify paths without dot notation', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['answers', 'fieldCode'],
      } satisfies ReferenceExpr

      // Act
      const result = referenceFactory.create(json)

      // Assert
      expect(result.properties.path).toEqual(['answers', 'fieldCode'])
    })
  })
})

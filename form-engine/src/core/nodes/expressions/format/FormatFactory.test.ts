import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import type { FormatExpr, PipelineExpr, ReferenceExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import FormatFactory from './FormatFactory'

describe('FormatFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let formatFactory: FormatFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    formatFactory = new FormatFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Format expression with text and literal args', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Hello %1, welcome to %2',
        arguments: ['World', 'Earth'],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.FORMAT)
      expect(result.raw).toBe(json)

      expect(result.properties.template).toBeDefined()
      expect(result.properties.template).toBe('Hello %1, welcome to %2')

      expect(result.properties.arguments).toBeDefined()
      const args = result.properties.arguments
      expect(Array.isArray(args)).toBe(true)
      expect(args).toEqual(['World', 'Earth'])
    })

    it('should create a Format expression with single placeholder', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'address_%1_street',
        arguments: ['123'],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      expect(result.properties.template).toBe('address_%1_street')

      const args = result.properties.arguments
      expect(args).toHaveLength(1)
      expect(args[0]).toBe('123')
    })

    it('should create a Format expression with expression arguments', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Item %1',
        arguments: [{ type: ExpressionType.REFERENCE, path: ['user', 'id'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      const args = result.properties.arguments
      expect(args).toHaveLength(1)

      expect(args[0]).toHaveProperty('id')
      expect(args[0]).toHaveProperty('type')
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[0].expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should create a Format expression with multiple expression arguments', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: '%1_%2_%3',
        arguments: [
          { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['answers', 'field3'] } satisfies ReferenceExpr,
        ],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      const args = result.properties.arguments
      expect(args).toHaveLength(3)

      args.forEach((arg: any) => {
        expect(arg.id).toBeDefined()
        expect(arg.type).toBe(ASTNodeType.EXPRESSION)
        expect(arg.expressionType).toBe(ExpressionType.REFERENCE)
      })
    })

    it('should create a Format expression with mixed literal and expression arguments', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'user_%1_%2',
        arguments: ['prefix', { type: ExpressionType.REFERENCE, path: ['answers', 'userId'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      const args = result.properties.arguments
      expect(args).toHaveLength(2)

      expect(args[0]).toBe('prefix')

      expect(args[1]).toHaveProperty('id')
      expect(args[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[1].expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should handle Format expression with HTML in text', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: '<h3>This is item %1</h3>',
        arguments: [{ type: ExpressionType.REFERENCE, path: ['answers', 'itemName'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      expect(result.properties.template).toBe('<h3>This is item %1</h3>')

      const args = result.properties.arguments
      expect(args).toHaveLength(1)
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create a Format expression with nested expression arguments', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Result: %1',
        arguments: [
          {
            type: ExpressionType.PIPELINE,
            input: { type: ExpressionType.REFERENCE, path: ['answers', 'value'] } satisfies ReferenceExpr,
            steps: [{ type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any }],
          } satisfies PipelineExpr,
        ],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      const args = result.properties.arguments
      expect(args).toHaveLength(1)

      expect(args[0].id).toBeDefined()
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[0].expressionType).toBe(ExpressionType.PIPELINE)
    })

    it('should handle Format expression with empty args array', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'No placeholders here',
        arguments: [] as any,
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      expect(result.properties.template).toBe('No placeholders here')

      const args = result.properties.arguments
      expect(Array.isArray(args)).toBe(true)
      expect(args).toHaveLength(0)
    })

    it('should handle Format expression with numeric literal arguments', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Page %1 of %2',
        arguments: [1, 10],
      } satisfies FormatExpr

      // Act
      const result = formatFactory.create(json)

      // Assert
      const args = result.properties.arguments
      expect(args).toEqual([1, 10])
    })

    it('should generate unique node IDs for Format expressions', () => {
      // Arrange
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Item %1',
        arguments: ['test'],
      } satisfies FormatExpr

      // Act
      const result1 = formatFactory.create(json)
      const result2 = formatFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})

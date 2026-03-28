import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import type { PipelineExpr, ReferenceExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import PipelineFactory from './PipelineFactory'

describe('PipelineFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let pipelineFactory: PipelineFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    pipelineFactory = new PipelineFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Pipeline expression with input and steps', () => {
      // Arrange
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'value'] } satisfies ReferenceExpr,
        steps: [
          { type: FunctionType.TRANSFORMER, name: 'trim', arguments: [] as any },
          { type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any },
        ],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.PIPELINE)
      expect(result.raw).toBe(json)

      expect(result.properties.input).toBeDefined()
      expect(result.properties.steps).toBeDefined()
      expect(Array.isArray(result.properties.steps)).toBe(true)
    })

    it('should transform input using real nodeFactory', () => {
      // Arrange
      const inputJson = { type: ExpressionType.REFERENCE, path: ['answers', 'name'] } satisfies ReferenceExpr
      const json = {
        type: ExpressionType.PIPELINE,
        input: inputJson,
        steps: [{ type: FunctionType.TRANSFORMER, name: 'trim', arguments: [] as any }],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)
      const input = result.properties.input

      // Assert
      expect(input.type).toBe(ASTNodeType.EXPRESSION)
      expect(input.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should preserve step names and transform step arguments', () => {
      // Arrange
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'value'] } satisfies ReferenceExpr,
        steps: [
          { type: FunctionType.TRANSFORMER, name: 'pad', arguments: [10, '0'] },
          { type: FunctionType.TRANSFORMER, name: 'substring', arguments: [0, 5] },
        ],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)

      // Assert
      const steps = result.properties.steps as FunctionASTNode[]
      expect(Array.isArray(steps)).toBe(true)
      expect(steps).toHaveLength(2)

      expect(steps[0].properties.name).toBe('pad')
      expect(steps[0].properties.arguments).toEqual([10, '0'])

      expect(steps[1].properties.name).toBe('substring')
      expect(steps[1].properties.arguments).toEqual([0, 5])
    })

    it('should transform step arguments that are expressions', () => {
      // Arrange
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'value'] } satisfies ReferenceExpr,
        steps: [
          {
            type: FunctionType.TRANSFORMER,
            name: 'replace',
            arguments: [
              'old',
              { type: ExpressionType.REFERENCE, path: ['answers', 'replacement'] } satisfies ReferenceExpr,
            ],
          },
        ],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)

      // Assert
      const steps = result.properties.steps as FunctionASTNode[]
      expect(steps).toHaveLength(1)
      expect(steps[0].properties.name).toBe('replace')
      expect(steps[0].properties.arguments).toHaveLength(2)
      expect(steps[0].properties.arguments[0]).toBe('old')

      // Second argument should be transformed to AST node
      expect(steps[0].properties.arguments[1]).toHaveProperty('id')
      expect(steps[0].properties.arguments[1]).toHaveProperty('type')
      expect(steps[0].properties.arguments[1].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle steps without arguments', () => {
      // Arrange
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'value'] } satisfies ReferenceExpr,
        steps: [
          { type: FunctionType.TRANSFORMER, name: 'trim', arguments: [] as any },
          { type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any },
        ],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)
      const steps = result.properties.steps as FunctionASTNode[]

      // Assert
      expect(steps[0].properties.name).toBe('trim')
      expect(steps[0].properties.arguments).toEqual([])
      expect(steps[1].properties.name).toBe('uppercase')
      expect(steps[1].properties.arguments).toEqual([])
    })

    it('should support literal array as input (for Literal() builder)', () => {
      // Arrange - simulates Literal([1, 2, 3]).pipe(...)
      const literalArray = [1, 2, 3]
      const json = {
        type: ExpressionType.PIPELINE,
        input: literalArray as any,
        steps: [{ type: FunctionType.TRANSFORMER, name: 'filter', arguments: [] as any }],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)

      // Assert - input should be preserved as-is (arrays are transformed but values preserved)
      expect(result.properties.input).toEqual([1, 2, 3])
    })

    it('should support literal string as input (for Literal() builder)', () => {
      // Arrange - simulates Literal('hello').pipe(...)
      const json = {
        type: ExpressionType.PIPELINE,
        input: 'hello' as any,
        steps: [{ type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any }],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)

      // Assert - input should be preserved as-is
      expect(result.properties.input).toBe('hello')
    })

    it('should support literal object as input (for Literal() builder)', () => {
      // Arrange - simulates Literal({ name: 'test' }).pipe(...)
      const literalObj = { name: 'test', count: 5 }
      const json = {
        type: ExpressionType.PIPELINE,
        input: literalObj as any,
        steps: [{ type: FunctionType.TRANSFORMER, name: 'transform', arguments: [] as any }],
      } satisfies PipelineExpr

      // Act
      const result = pipelineFactory.create(json)

      // Assert - input should be preserved as-is
      expect(result.properties.input).toEqual({ name: 'test', count: 5 })
    })
  })
})

import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import type {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import FunctionFactory from './FunctionFactory'

describe('FunctionFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let functionFactory: FunctionFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    functionFactory = new FunctionFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Function expression with Condition type', () => {
      // Arrange
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsTrue',
        arguments: [] as ValueExpr[],
      }

      // Act
      const result = functionFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(FunctionType.CONDITION)
      expect(result.raw).toBe(json)

      expect(result.properties.name).toBe('IsTrue')
      expect(result.properties.arguments).toBeDefined()
      expect(Array.isArray(result.properties.arguments)).toBe(true)
    })

    it('should create a Function expression with Transformer type', () => {
      // Arrange
      const json = {
        type: FunctionType.TRANSFORMER,
        name: 'Uppercase',
        arguments: [] as ValueExpr[],
      } satisfies TransformerFunctionExpr

      // Act
      const result = functionFactory.create(json)

      // Assert
      expect(result.expressionType).toBe(FunctionType.TRANSFORMER)
      expect(result.properties.name).toBe('Uppercase')
    })

    it('should create a Function expression with Effect type', () => {
      // Arrange
      const json = {
        type: FunctionType.EFFECT,
        name: 'SaveData',
        arguments: [] as ValueExpr[],
      } satisfies EffectFunctionExpr

      // Act
      const result = functionFactory.create(json)

      // Assert
      expect(result.expressionType).toBe(FunctionType.EFFECT)
      expect(result.properties.name).toBe('SaveData')
    })

    it('should create a Function expression with Generator type', () => {
      // Arrange
      const json = {
        type: FunctionType.GENERATOR,
        name: 'GenerateID',
        arguments: [] as ValueExpr[],
      }

      // Act
      const result = functionFactory.create(json)

      // Assert
      expect(result.expressionType).toBe(FunctionType.GENERATOR)
      expect(result.properties.name).toBe('GenerateID')
    })

    it('should transform literal arguments', () => {
      // Arrange
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsEqual',
        arguments: ['value1', 42, true],
      } satisfies ConditionFunctionExpr

      // Act
      const result = functionFactory.create(json)
      const args = result.properties.arguments

      // Assert
      expect(Array.isArray(args)).toBe(true)
      expect(args).toEqual(['value1', 42, true])
    })

    it('should transform expression arguments', () => {
      // Arrange
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsEqual',
        arguments: [
          { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] } satisfies ReferenceExpr,
        ],
      } satisfies ConditionFunctionExpr

      // Act
      const result = functionFactory.create(json)
      const args = result.properties.arguments

      // Assert
      expect(args).toHaveLength(2)

      args.forEach((arg: any) => {
        expect(arg.id).toBeDefined()
        expect(arg.type).toBe(ASTNodeType.EXPRESSION)
        expect(arg.expressionType).toBe(ExpressionType.REFERENCE)
      })
    })

    it('should transform mixed literal and expression arguments', () => {
      // Arrange
      const json = {
        type: FunctionType.TRANSFORMER,
        name: 'Replace',
        arguments: [
          'searchString',
          { type: ExpressionType.REFERENCE, path: ['answers', 'replacementValue'] } satisfies ReferenceExpr,
          true,
        ],
      } satisfies TransformerFunctionExpr

      // Act
      const result = functionFactory.create(json)
      const args = result.properties.arguments

      // Assert
      expect(args).toHaveLength(3)
      expect(args[0]).toBe('searchString')
      expect(args[1]).toHaveProperty('id')
      expect(args[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[2]).toBe(true)
    })

    it('should handle nested function arguments', () => {
      // Arrange
      const json = {
        type: FunctionType.CONDITION,
        name: 'And',
        arguments: [
          {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [{ type: ExpressionType.REFERENCE, path: ['answers', 'field1'] } satisfies ReferenceExpr],
          } satisfies ConditionFunctionExpr,
          {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [{ type: ExpressionType.REFERENCE, path: ['answers', 'field2'] } satisfies ReferenceExpr],
          } satisfies ConditionFunctionExpr,
        ],
      } satisfies ConditionFunctionExpr

      // Act
      const result = functionFactory.create(json)

      // Assert
      const args = result.properties.arguments
      expect(args).toHaveLength(2)

      // Nested functions should be transformed to AST nodes
      args.forEach((arg: any) => {
        expect(arg).toHaveProperty('id')
        expect(arg).toHaveProperty('type')
        expect(arg.type).toBe(ASTNodeType.EXPRESSION)
        expect(arg.properties.name).toBeDefined()
        expect(arg.properties.arguments).toBeDefined()
      })
    })
  })
})

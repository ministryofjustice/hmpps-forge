import { ASTNodeType } from '../../../contracts/ast/enums'
import {
  ConditionCombinatorType,
  ExpressionType,
  FunctionType,
  PredicateType,
  BlockType,
  IteratorType,
  StructureType,
} from '../../../../../authoring/types/enums'
import type {
  ReferenceExpr,
  PipelineExpr,
  ConditionalExpr,
  ConditionBranchExpr,
  MatchExpr,
  PredicateTestExpr,
  ResolvableValue,
  ConditionFunctionExpr,
  EffectFunctionExpr,
  TransformerFunctionExpr,
  IterateExpr,
} from '../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import {
  ExpressionASTNode,
  FunctionASTNode,
  ConditionalASTNode,
  MatchASTNode,
  ReferenceASTNode,
} from '../../../contracts/ast/expressions.type'
import { NodeFactory } from './NodeFactory'
import ForgeInvalidNodeError from '../../../../errors/ForgeInvalidNodeError'
import type {
  AndPredicateASTNode,
  NotPredicateASTNode,
  OrPredicateASTNode,
  PredicateASTNode,
  TestPredicateASTNode,
  XorPredicateASTNode,
} from '../../../contracts/ast/predicates.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import { TemplateNode } from '../../../contracts/ast/template.type'
import type { ValidationExpr } from '../../../../../authoring/types/structures.type'
import {
  createConditionalNode,
  createFunctionNode,
  createIterateNode,
  createPipelineNode,
  createReferenceNode,
  createValidationNode,
  createMatchNode,
} from './expressions'

describe('expressions', () => {
  describe('createReferenceNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Reference expression with simple path', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['answers', 'field'],
      } satisfies ReferenceExpr

      // Act
      const result = createReferenceNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.REFERENCE)
      expect(result.properties.path).toBeDefined()

      const path = result.properties.path
      expect(Array.isArray(path)).toBe(true)
      expect(path).toEqual(['answers', 'field'])

    })

    it('should transform path segments that are expressions', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['items', { type: ExpressionType.REFERENCE, path: ['scope', 'index'] }],
      } as ReferenceExpr

      // Act
      const result = createReferenceNode(json, nodeFactory.context)

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
      expect(() => createReferenceNode(json as any, nodeFactory.context)).toThrow(
        'Reference path must be a non-empty array',
      )
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['answers', 'field'],
      } satisfies ReferenceExpr

      // Act
      const result1 = createReferenceNode(json, nodeFactory.context)
      const result2 = createReferenceNode(json, nodeFactory.context)

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
      const result = createReferenceNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.path).toEqual(['answers', 'fieldCode'])
    })
  })

  describe('createPipelineNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

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
      const result = createPipelineNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.PIPELINE)

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
      const result = createPipelineNode(json, nodeFactory.context)
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
      const result = createPipelineNode(json, nodeFactory.context)

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
      const result = createPipelineNode(json, nodeFactory.context)

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
      const result = createPipelineNode(json, nodeFactory.context)
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
      const result = createPipelineNode(json, nodeFactory.context)

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
      const result = createPipelineNode(json, nodeFactory.context)

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
      const result = createPipelineNode(json, nodeFactory.context)

      // Assert - input should be preserved as-is
      expect(result.properties.input).toEqual({ name: 'test', count: 5 })
    })
  })

  describe('createConditionalNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Conditional expression with all properties', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      // Act
      const result = createConditionalNode(json, nodeFactory.context) as ConditionalASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.CONDITIONAL)
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
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      const json = {
        type: ExpressionType.CONDITIONAL,
        predicate: predicateJson,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      // Act
      const result = createConditionalNode(json, nodeFactory.context)
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
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        thenValue: 'literalThen',
        elseValue: 'literalElse',
      } satisfies ConditionalExpr

      // Act
      const result = createConditionalNode(json, nodeFactory.context)

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
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        thenValue: { type: ExpressionType.REFERENCE, path: ['answers', 'thenField'] },
        elseValue: { type: ExpressionType.REFERENCE, path: ['answers', 'elseField'] },
      } satisfies ConditionalExpr

      // Act
      const result = createConditionalNode(json, nodeFactory.context)

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
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        elseValue: 'no',
      }

      // Act
      const result = createConditionalNode(json as ConditionalExpr, nodeFactory.context)

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
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
      }

      // Act
      const result = createConditionalNode(json as ConditionalExpr, nodeFactory.context)

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
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      // Act
      const result1 = createConditionalNode(json, nodeFactory.context)
      const result2 = createConditionalNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should throw ForgeInvalidNodeError when predicate is missing', () => {
      // Arrange
      const json = {
        type: ExpressionType.CONDITIONAL,
        thenValue: 'yes',
        elseValue: 'no',
      } as any

      // Act & Assert
      expect(() => createConditionalNode(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      expect(() => createConditionalNode(json, nodeFactory.context)).toThrow(
        'Conditional expression requires a predicate',
      )
    })
  })

  describe('createFunctionNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Function expression with Condition type', () => {
      // Arrange
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsTrue',
        arguments: [] as ResolvableValue[],
      }

      // Act
      const result = createFunctionNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(FunctionType.CONDITION)

      expect(result.properties.name).toBe('IsTrue')
      expect(result.properties.arguments).toBeDefined()
      expect(Array.isArray(result.properties.arguments)).toBe(true)
    })

    it('should create a Function expression with Transformer type', () => {
      // Arrange
      const json = {
        type: FunctionType.TRANSFORMER,
        name: 'Uppercase',
        arguments: [] as ResolvableValue[],
      } satisfies TransformerFunctionExpr

      // Act
      const result = createFunctionNode(json, nodeFactory.context)

      // Assert
      expect(result.expressionType).toBe(FunctionType.TRANSFORMER)
      expect(result.properties.name).toBe('Uppercase')
    })

    it('should create a Function expression with Effect type', () => {
      // Arrange
      const json = {
        type: FunctionType.EFFECT,
        name: 'SaveData',
        arguments: [] as ResolvableValue[],
      } satisfies EffectFunctionExpr

      // Act
      const result = createFunctionNode(json, nodeFactory.context)

      // Assert
      expect(result.expressionType).toBe(FunctionType.EFFECT)
      expect(result.properties.name).toBe('SaveData')
    })

    it('should create a Function expression with Generator type', () => {
      // Arrange
      const json = {
        type: FunctionType.GENERATOR,
        name: 'GenerateID',
        arguments: [] as ResolvableValue[],
      }

      // Act
      const result = createFunctionNode(json, nodeFactory.context)

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
      const result = createFunctionNode(json, nodeFactory.context)
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
      const result = createFunctionNode(json, nodeFactory.context)
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
      const result = createFunctionNode(json, nodeFactory.context)
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
      const result = createFunctionNode(json, nodeFactory.context)

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

  describe('createIterateNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create an Iterate expression with a compiled MAP template', () => {
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
      const result = createIterateNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.ITERATE)
      expect(result.properties.iterator.type).toBe(IteratorType.MAP)
      expect(result.properties.iterator.yieldTemplate).toBeDefined()
      expect(isTemplateNode(result.properties.iterator.yieldTemplate)).toBe(true)
    })

    it('should create an Iterate expression with a compiled FILTER template', () => {
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
      const result = createIterateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.iterator.type).toBe(IteratorType.FILTER)
      expect(result.properties.iterator.predicateTemplate).toBeDefined()
      expect(isTemplateNode(result.properties.iterator.predicateTemplate)).toBe(true)
    })

    it('should create an Iterate expression with a compiled FIND template', () => {
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
      const result = createIterateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.iterator.type).toBe(IteratorType.FIND)
      expect(result.properties.iterator.predicateTemplate).toBeDefined()
      expect(isTemplateNode(result.properties.iterator.predicateTemplate)).toBe(true)
    })

    it('should transform the input expression', () => {
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
      const result = createIterateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.input).toHaveProperty('id')
      expect(result.properties.input.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.input.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should store compiled templates instead of raw iterator JSON', () => {
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
      const result = createIterateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.iterator.yieldTemplate).toBeDefined()
      expect(result.properties.iterator.yieldTemplate).not.toEqual(yieldTemplate)

      const compiledTemplate = result.properties.iterator.yieldTemplate as TemplateNode

      expect(compiledTemplate.type).toBe(ASTNodeType.TEMPLATE)
      expect(compiledTemplate.originalType).toBe(ASTNodeType.EXPRESSION)
      expect(compiledTemplate.properties?.path).toEqual(['scope', 'item', 'value'])
    })

    it('should not add Self() value to fields at compile time (deferred to runtime)', () => {
      // Arrange
      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.MAP,
          yield: {
            type: StructureType.BLOCK,
            blockType: BlockType.FIELD,
            variant: 'textInput',
            code: 'street',
            label: 'Street',
          },
        },
      } satisfies IterateExpr

      // Act
      const result = createIterateNode(json, nodeFactory.context)
      const yieldTemplate = result.properties.iterator.yieldTemplate as TemplateNode

      // Assert — the compiled field template carries no `value`; compiled iterator expansion adds @self at runtime
      expect(yieldTemplate.originalType).toBe(ASTNodeType.BLOCK)
      expect(yieldTemplate.properties?.value).toBeUndefined()
    })

    it('should preserve @self references for runtime resolution', () => {
      // Arrange
      const json = {
        type: ExpressionType.ITERATE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] } satisfies ReferenceExpr,
        iterator: {
          type: IteratorType.MAP,
          yield: {
            type: StructureType.BLOCK,
            blockType: BlockType.FIELD,
            variant: 'textInput',
            code: 'street',
            label: {
              type: ExpressionType.REFERENCE,
              path: ['answers', '@self'],
            },
          },
        },
      } satisfies IterateExpr

      // Act
      const result = createIterateNode(json, nodeFactory.context)
      const yieldTemplate = result.properties.iterator.yieldTemplate as TemplateNode
      const labelTemplate = yieldTemplate.properties?.label as TemplateNode

      // Assert — @self is preserved in the compiled reference template; compiled iterator expansion resolves it at runtime
      expect(isTemplateNode(labelTemplate)).toBe(true)
      expect(labelTemplate.properties?.path).toEqual(['answers', '@self'])
    })

    it('should generate unique iterate node ids', () => {
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
      const result1 = createIterateNode(json, nodeFactory.context)
      const result2 = createIterateNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('createValidationNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Validation expression with message', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Field is required',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.VALIDATION)

      expect(result.properties.message !== undefined).toBe(true)
      expect(result.properties.message).toBe('Field is required')
    })

    it('should create a Validation expression with condition predicate', () => {
      // Arrange
      const conditionPredicate = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
        negate: false,
        condition: {
          type: FunctionType.CONDITION,
          name: 'IsNotEmpty',
          arguments: [] as ResolvableValue[],
        } satisfies ConditionFunctionExpr,
      } satisfies PredicateTestExpr

      const json = {
        type: ExpressionType.VALIDATION,
        condition: conditionPredicate,
        message: 'Invalid value',
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)
      const condition = result.properties.condition

      // Assert
      expect(result.id).toBeDefined()
      expect(condition.type).toBe(ASTNodeType.PREDICATE)
      expect(result.properties.condition !== undefined).toBe(true)
    })

    it('should set submissionOnly flag when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        submissionOnly: true,
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.submissionOnly).toBe(true)
    })

    it('should set submissionOnly to false when explicitly false', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        submissionOnly: false,
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.submissionOnly).toBe(false)
    })

    it('should default submissionOnly to false when undefined', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.submissionOnly).toBe(false)
    })

    it('should default groups to default when omitted', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.groups).toEqual(['default'])
    })

    it('should set groups when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        groups: ['lookup', 'default'],
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.groups).toEqual(['lookup', 'default'])
    })

    it('should set details when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        details: { code: 'VALIDATION_001', severity: 'error' },
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.details !== undefined).toBe(true)
      expect(result.properties.details).toEqual({
        code: 'VALIDATION_001',
        severity: 'error',
      })
    })

    it('should not set details when not provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.details !== undefined).toBe(false)
    })

    it('should default message to empty string when not provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: '',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.message).toBe('')
    })

    it('should create a Validation expression with all properties', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        message: 'Custom error message',
        submissionOnly: true,
        details: { code: 'ERR_001' },
      } satisfies ValidationExpr

      // Act
      const result = createValidationNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.condition !== undefined).toBe(true)
      expect(result.properties.message !== undefined).toBe(true)
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.details !== undefined).toBe(true)

      expect(result.properties.message).toBe('Custom error message')
      expect(result.properties.submissionOnly).toBe(true)
      expect(result.properties.details).toEqual({ code: 'ERR_001' })
    })
  })

  describe('createMatchNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory
    // Helpers for the combinator branch cases, which need larger condition trees than a single condition
    const equals = (value: string): ConditionFunctionExpr => ({
      type: FunctionType.CONDITION,
      name: 'Equals',
      arguments: [value],
    })

    const matchOn = (condition: ConditionBranchExpr): MatchExpr => ({
      type: ExpressionType.MATCH,
      subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
      branches: [{ condition, value: 'Result' }],
    })

    const branchPredicate = (json: MatchExpr): PredicateASTNode =>
      createMatchNode(json, nodeFactory.context).properties.branches[0].predicate as PredicateASTNode

    const testLeaf = (predicate: PredicateASTNode) => {
      const leaf = predicate as TestPredicateASTNode

      return {
        predicateType: leaf.predicateType,
        negate: leaf.properties.negate,
        subjectPath: (leaf.properties.subject as ReferenceASTNode).properties.path,
        conditionArguments: (leaf.properties.condition as FunctionASTNode).properties.arguments,
      }
    }

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Match expression with all properties', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['ACTIVE' as ResolvableValue] },
            value: 'Active',
          },
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['CLOSED' as ResolvableValue] },
            value: 'Closed',
          },
        ],
        otherwise: 'Unknown',
      } satisfies MatchExpr

      // Act
      const result = createMatchNode(json, nodeFactory.context) as MatchASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.MATCH)
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
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'Result A',
          },
        ],
        otherwise: 'Default',
      } satisfies MatchExpr

      // Act
      const result = createMatchNode(json, nodeFactory.context)
      const predicate = result.properties.branches[0].predicate as TestPredicateASTNode

      // Assert
      expect(predicate.type).toBe(ASTNodeType.PREDICATE)
      expect(predicate.predicateType).toBe(PredicateType.TEST)
    })

    it('should synthesise a TEST predicate carrying the subject when the branch is a single condition', () => {
      // Arrange
      const json = matchOn(equals('A'))

      // Act
      const predicate = branchPredicate(json)

      // Assert
      expect(testLeaf(predicate)).toEqual({
        predicateType: PredicateType.TEST,
        negate: false,
        subjectPath: ['data', 'status'],
        conditionArguments: ['A'],
      })
    })

    it('should expand an AND branch condition into an AND predicate over TEST leaves', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.AND, operands: [equals('A'), equals('B')] })

      // Act
      const predicate = branchPredicate(json) as AndPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.AND)
      expect(predicate.properties.operands.map(testLeaf)).toEqual([
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['A'],
        },
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['B'],
        },
      ])
    })

    it('should expand an OR branch condition into an OR predicate over TEST leaves', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.OR, operands: [equals('A'), equals('B')] })

      // Act
      const predicate = branchPredicate(json) as OrPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.OR)
      expect(predicate.properties.operands.map(testLeaf)).toEqual([
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['A'],
        },
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['B'],
        },
      ])
    })

    it('should expand an XOR branch condition into an XOR predicate over TEST leaves', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.XOR, operands: [equals('A'), equals('B')] })

      // Act
      const predicate = branchPredicate(json) as XorPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.XOR)
      expect(predicate.properties.operands.map(testLeaf)).toEqual([
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['A'],
        },
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['B'],
        },
      ])
    })

    it('should expand a NOT branch condition into a NOT predicate over a TEST leaf', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.NOT, operand: equals('A') })

      // Act
      const predicate = branchPredicate(json) as NotPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.NOT)
      expect(testLeaf(predicate.properties.operand as PredicateASTNode)).toEqual({
        predicateType: PredicateType.TEST,
        negate: false,
        subjectPath: ['data', 'status'],
        conditionArguments: ['A'],
      })
    })

    it('should expand a nested combinator tree into matching nested predicates', () => {
      // Arrange
      const json = matchOn({
        type: ConditionCombinatorType.OR,
        operands: [
          { type: ConditionCombinatorType.AND, operands: [equals('A'), equals('B')] },
          { type: ConditionCombinatorType.NOT, operand: equals('C') },
        ],
      })

      // Act
      const predicate = branchPredicate(json) as OrPredicateASTNode
      const [nestedAnd, nestedNot] = predicate.properties.operands as [AndPredicateASTNode, NotPredicateASTNode]

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.OR)
      expect(nestedAnd.predicateType).toBe(PredicateType.AND)
      expect(nestedAnd.properties.operands.map(operand => testLeaf(operand).conditionArguments)).toEqual([['A'], ['B']])
      expect(nestedNot.predicateType).toBe(PredicateType.NOT)
      expect(testLeaf(nestedNot.properties.operand as PredicateASTNode).conditionArguments).toEqual(['C'])
    })

    it('should generate unique node IDs across the synthesised predicates of a combinator tree', () => {
      // Arrange
      const json = matchOn({
        type: ConditionCombinatorType.OR,
        operands: [
          { type: ConditionCombinatorType.AND, operands: [equals('A'), equals('B')] },
          { type: ConditionCombinatorType.NOT, operand: equals('C') },
        ],
      })

      // Act
      const predicate = branchPredicate(json) as OrPredicateASTNode
      const [nestedAnd, nestedNot] = predicate.properties.operands as [AndPredicateASTNode, NotPredicateASTNode]
      const ids = [
        predicate.id,
        nestedAnd.id,
        ...nestedAnd.properties.operands.map(operand => operand.id),
        nestedNot.id,
        (nestedNot.properties.operand as PredicateASTNode).id,
      ]

      // Assert
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('should handle literal branch values', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'literalValue',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = createMatchNode(json, nodeFactory.context)

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
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: { type: ExpressionType.REFERENCE, path: ['answers', 'fieldA'] },
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = createMatchNode(json, nodeFactory.context)

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
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
        otherwise: 'Default',
      } satisfies MatchExpr

      // Act
      const result = createMatchNode(json, nodeFactory.context)

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
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = createMatchNode(json, nodeFactory.context)

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
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
        otherwise: { type: ExpressionType.REFERENCE, path: ['answers', 'fallback'] },
      } satisfies MatchExpr

      // Act
      const result = createMatchNode(json, nodeFactory.context)

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
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result1 = createMatchNode(json, nodeFactory.context)
      const result2 = createMatchNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should throw ForgeInvalidNodeError when subject is missing', () => {
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
      expect(() => createMatchNode(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      expect(() => createMatchNode(json, nodeFactory.context)).toThrow('Match expression requires a subject')
    })

    it('should accept falsy literal subjects when they are 0, empty string or false', () => {
      // Arrange
      const falsySubjects = [0, '', false]

      // Act
      const results = falsySubjects.map(subject =>
        createMatchNode(
          {
            type: ExpressionType.MATCH,
            subject,
            branches: [
              {
                condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A'] },
                value: 'A',
              },
            ],
          } as MatchExpr,
          nodeFactory.context,
        ),
      )

      // Assert
      const branchSubjects = results.map(
        result => (result.properties.branches[0].predicate as TestPredicateASTNode).properties.subject,
      )
      expect(branchSubjects).toEqual(falsySubjects)
    })

    it('should throw ForgeInvalidNodeError when branches is empty', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [],
      } as any

      // Act & Assert
      expect(() => createMatchNode(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      expect(() => createMatchNode(json, nodeFactory.context)).toThrow('Match expression requires at least one branch')
    })

    it('should throw ForgeInvalidNodeError when branches is missing', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
      } as any

      // Act & Assert
      expect(() => createMatchNode(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      expect(() => createMatchNode(json, nodeFactory.context)).toThrow('Match expression requires at least one branch')
    })
  })
})

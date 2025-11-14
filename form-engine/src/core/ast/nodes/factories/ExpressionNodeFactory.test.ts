import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, LogicType } from '@form-engine/form/types/enums'
import {
  CollectionExpr,
  ConditionFunctionExpr,
  EffectFunctionExpr,
  FormatExpr,
  PipelineExpr,
  PredicateTestExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { BlockDefinition, ValidationExpr } from '@form-engine/form/types/structures.type'
import { NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import {
  CollectionASTNode,
  ExpressionASTNode,
  FormatASTNode,
  FunctionASTNode,
  PipelineASTNode,
  ReferenceASTNode,
  ValidationASTNode,
} from '@form-engine/core/types/expressions.type'
import { NodeFactory } from '../NodeFactory'
import { ExpressionNodeFactory } from './ExpressionNodeFactory'

describe('ExpressionNodeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let expressionFactory: ExpressionNodeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    expressionFactory = new ExpressionNodeFactory(nodeIDGenerator, nodeFactory)
  })

  describe('create', () => {
    it('should route to createReference for Reference expressions', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['field', 'value'],
      } satisfies ReferenceExpr

      const result = expressionFactory.create(json) as ReferenceASTNode

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.REFERENCE)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
      expect(result.properties.path).toBeDefined()
    })

    it('should route to createFormat for Format expressions', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Hello %1',
        arguments: ['World'],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.FORMAT)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
      expect(result.properties.template).toBeDefined()
      expect(result.properties.arguments).toBeDefined()
    })

    it('should route to createPipeline for Pipeline expressions', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [{ type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any }],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json) as PipelineASTNode

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.PIPELINE)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createCollection for Collection expressions', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['data', 'items'] } satisfies ReferenceExpr,
        template: [] as BlockDefinition[],
      } satisfies CollectionExpr<BlockDefinition>

      const result = expressionFactory.create(json) as CollectionASTNode

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.COLLECTION)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createValidation for Validation expressions', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Field is required',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.VALIDATION)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createFunction for Function expressions', () => {
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsTrue',
        arguments: [] as ValueExpr[],
      } satisfies ConditionFunctionExpr

      const result = expressionFactory.create(json) as FunctionASTNode

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(FunctionType.CONDITION)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should throw UnknownNodeTypeError for unknown expression types', () => {
      const json = {
        type: 'CustomExpression.Unknown',
        customProperty: 'value',
      }

      expect(() => expressionFactory.create(json)).toThrow(UnknownNodeTypeError)

      try {
        expressionFactory.create(json)
      } catch (error) {
        expect(error).toBeInstanceOf(UnknownNodeTypeError)
        expect((error as UnknownNodeTypeError).message).toContain('Unknown node type')
        expect((error as UnknownNodeTypeError).nodeType).toBe('CustomExpression.Unknown')
        expect((error as UnknownNodeTypeError).validTypes).toEqual([
          'Reference',
          'Format',
          'Pipeline',
          'Collection',
          'Validation',
          'Function',
          'Next',
        ])
        expect((error as UnknownNodeTypeError).node).toBe(json)
      }
    })
  })

  describe('createFormat', () => {
    it('should create a Format expression with text and literal args', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Hello %1, welcome to %2',
        arguments: ['World', 'Earth'],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

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
      const json = {
        type: ExpressionType.FORMAT,
        template: 'address_%1_street',
        arguments: ['123'],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      expect(result.properties.template).toBe('address_%1_street')

      const args = result.properties.arguments
      expect(args).toHaveLength(1)
      expect(args[0]).toBe('123')
    })

    it('should create a Format expression with expression arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Item %1',
        arguments: [{ type: ExpressionType.REFERENCE, path: ['user', 'id'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      const args = result.properties.arguments
      expect(args).toHaveLength(1)

      expect(args[0]).toHaveProperty('id')
      expect(args[0]).toHaveProperty('type')
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[0].expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should create a Format expression with multiple expression arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: '%1_%2_%3',
        arguments: [
          { type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['field3'] } satisfies ReferenceExpr,
        ],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      const args = result.properties.arguments
      expect(args).toHaveLength(3)

      args.forEach((arg: any) => {
        expect(arg.id).toBeDefined()
        expect(arg.type).toBe(ASTNodeType.EXPRESSION)
        expect(arg.expressionType).toBe(ExpressionType.REFERENCE)
      })
    })

    it('should create a Format expression with mixed literal and expression arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'user_%1_%2',
        arguments: ['prefix', { type: ExpressionType.REFERENCE, path: ['userId'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      const args = result.properties.arguments
      expect(args).toHaveLength(2)

      expect(args[0]).toBe('prefix')

      expect(args[1]).toHaveProperty('id')
      expect(args[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[1].expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should handle Format expression with HTML in text', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: '<h3>This is item %1</h3>',
        arguments: [{ type: ExpressionType.REFERENCE, path: ['itemName'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      expect(result.properties.template).toBe('<h3>This is item %1</h3>')

      const args = result.properties.arguments
      expect(args).toHaveLength(1)
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create a Format expression with nested expression arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Result: %1',
        arguments: [
          {
            type: ExpressionType.PIPELINE,
            input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
            steps: [{ type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any }],
          } satisfies PipelineExpr,
        ],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      const args = result.properties.arguments
      expect(args).toHaveLength(1)

      expect(args[0].id).toBeDefined()
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[0].expressionType).toBe(ExpressionType.PIPELINE)
    })

    it('should handle Format expression with empty args array', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'No placeholders here',
        arguments: [] as any,
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      expect(result.properties.template).toBe('No placeholders here')

      const args = result.properties.arguments
      expect(Array.isArray(args)).toBe(true)
      expect(args).toHaveLength(0)
    })

    it('should handle Format expression with numeric literal arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Page %1 of %2',
        arguments: [1, 10],
      } satisfies FormatExpr

      const result = expressionFactory.create(json) as FormatASTNode

      const args = result.properties.arguments
      expect(args).toEqual([1, 10])
    })

    it('should generate unique node IDs for Format expressions', () => {
      const json = {
        type: ExpressionType.FORMAT,
        template: 'Item %1',
        arguments: ['test'],
      } satisfies FormatExpr

      const result1 = expressionFactory.create(json) as FormatASTNode
      const result2 = expressionFactory.create(json) as FormatASTNode

      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('createReference', () => {
    it('should create a Reference expression with simple path', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['field'],
      } satisfies ReferenceExpr

      const result = expressionFactory.create(json) as ReferenceASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.REFERENCE)
      expect(result.properties.path).toBeDefined()

      const path = result.properties.path
      expect(Array.isArray(path)).toBe(true)
      expect(path).toEqual(['field'])

      expect(result.raw).toBe(json)
    })

    it('should create a Reference expression with nested path', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['data', 'user', 'name'],
      } satisfies ReferenceExpr

      const result = expressionFactory.create(json) as ReferenceASTNode

      const path = result.properties.path
      expect(path).toEqual(['data', 'user', 'name'])
    })

    it('should transform path segments that are expressions', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: [
          'items',
          { type: ExpressionType.REFERENCE, path: ['index'] }, // Dynamic path segment
        ],
      }

      const result = expressionFactory.create(json) as ReferenceASTNode

      const path = result.properties.path
      expect(Array.isArray(path)).toBe(true)
      expect(path).toHaveLength(2)
      expect(path[0]).toBe('items')

      // Second segment should be transformed to an AST node
      expect(path[1]).toHaveProperty('id')
      expect(path[1]).toHaveProperty('type')
      expect((path[1] as ExpressionASTNode).type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle non-array path values', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: 'simpleString',
      }

      const result = expressionFactory.create(json) as ReferenceASTNode
      const path = result.properties.path

      expect(path).toBe('simpleString')
    })

    it('should generate unique node IDs', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['field'],
      } satisfies ReferenceExpr

      const result1 = expressionFactory.create(json) as ReferenceASTNode
      const result2 = expressionFactory.create(json) as ReferenceASTNode

      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('createPipeline', () => {
    it('should create a Pipeline expression with input and steps', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [
          { type: FunctionType.TRANSFORMER, name: 'trim', arguments: [] as any },
          { type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any },
        ],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json) as PipelineASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.PIPELINE)
      expect(result.raw).toBe(json)

      expect(result.properties.input).toBeDefined()
      expect(result.properties.steps).toBeDefined()
      expect(Array.isArray(result.properties.steps)).toBe(true)
    })

    it('should transform input using real nodeFactory', () => {
      const inputJson = { type: ExpressionType.REFERENCE, path: ['name'] } satisfies ReferenceExpr
      const json = {
        type: ExpressionType.PIPELINE,
        input: inputJson,
        steps: [{ type: FunctionType.TRANSFORMER, name: 'trim', arguments: [] as any }],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json) as PipelineASTNode
      const input = result.properties.input

      expect(input.type).toBe(ASTNodeType.EXPRESSION)
      expect(input.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should preserve step names and transform step arguments', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [
          { type: FunctionType.TRANSFORMER, name: 'pad', arguments: [10, '0'] },
          { type: FunctionType.TRANSFORMER, name: 'substring', arguments: [0, 5] },
        ],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json) as PipelineASTNode

      const steps = result.properties.steps as FunctionASTNode[]
      expect(Array.isArray(steps)).toBe(true)
      expect(steps).toHaveLength(2)

      expect(steps[0].properties.name).toBe('pad')
      expect(steps[0].properties.arguments).toEqual([10, '0'])

      expect(steps[1].properties.name).toBe('substring')
      expect(steps[1].properties.arguments).toEqual([0, 5])
    })

    it('should transform step arguments that are expressions', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [
          {
            type: FunctionType.TRANSFORMER,
            name: 'replace',
            arguments: [
              'old',
              { type: ExpressionType.REFERENCE, path: ['replacement'] } satisfies ReferenceExpr, // Expression argument
            ],
          },
        ],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json) as PipelineASTNode

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
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [
          { type: FunctionType.TRANSFORMER, name: 'trim', arguments: [] as any },
          { type: FunctionType.TRANSFORMER, name: 'uppercase', arguments: [] as any },
        ],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json) as PipelineASTNode
      const steps = result.properties.steps as FunctionASTNode[]

      expect(steps[0].properties.name).toBe('trim')
      expect(steps[0].properties.arguments).toEqual([])
      expect(steps[1].properties.name).toBe('uppercase')
      expect(steps[1].properties.arguments).toEqual([])
    })
  })

  describe('createCollection', () => {
    it('should create a Collection expression with collection and template', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [{ type: 'StructureType.Block', fields: [] as any }],
      }

      const result = expressionFactory.create(json) as CollectionASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.COLLECTION)
      expect(result.raw).toBe(json)

      expect(result.properties.collection).toBeDefined()
      expect(result.properties.template).toBeDefined()
    })

    it('should transform collection data source', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['data', 'items'] },
        template: [] as any,
      }

      const result = expressionFactory.create(json) as CollectionASTNode
      const collection = result.properties.collection as ExpressionASTNode

      expect(collection.type).toBe(ASTNodeType.EXPRESSION)
      expect(collection.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should store template as raw JSON (not transformed)', () => {
      const templateBlock = { type: 'StructureType.Block', fields: [] as any }
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [templateBlock],
      }

      const result = expressionFactory.create(json) as CollectionASTNode

      const template = result.properties.template
      expect(Array.isArray(template)).toBe(true)
      expect(template).toHaveLength(1)

      expect(template[0]).toBe(templateBlock)
      expect(template[0]).not.toHaveProperty('id')
    })

    it('should store multiple template blocks as raw JSON', () => {
      const block1 = { type: 'StructureType.Block', fields: [] as any }
      const block2 = { type: 'StructureType.Block', fields: [] as any }
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [block1, block2],
      }

      const result = expressionFactory.create(json) as CollectionASTNode

      const template = result.properties.template
      expect(template).toHaveLength(2)

      expect(template[0]).toBe(block1)
      expect(template[1]).toBe(block2)
      expect(template[0]).not.toHaveProperty('id')
      expect(template[1]).not.toHaveProperty('id')
    })

    it('should create a Collection expression with fallback', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [] as any,
        fallback: [{ type: 'StructureType.Block', fields: [] as any }],
      }

      const result = expressionFactory.create(json) as CollectionASTNode
      const fallback = result.properties.fallback

      expect(result.properties.fallback !== undefined).toBe(true)
      expect(Array.isArray(fallback)).toBe(true)
      expect(fallback).toHaveLength(1)

      expect(fallback[0].id).toBeDefined()
      expect(fallback[0].type).toBeDefined()
    })

    it('should handle collection without template', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
      }

      const result = expressionFactory.create(json) as CollectionASTNode

      expect(result.properties.collection).toBeDefined()
      expect(result.properties.template).toBeUndefined()
      expect(result.properties.fallback).toBeUndefined()
    })

    it('should handle collection without fallback', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [] as any,
      }

      const result = expressionFactory.create(json) as CollectionASTNode

      expect(result.properties.template).toBeDefined()
      expect(result.properties.fallback).toBeUndefined()
    })
  })

  describe('createValidation', () => {
    it('should create a Validation expression with message', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Field is required',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.VALIDATION)
      expect(result.raw).toBe(json)

      expect(result.properties.message !== undefined).toBe(true)
      expect(result.properties.message).toBe('Field is required')
    })

    it('should create a Validation expression with when condition', () => {
      const whenCondition = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] } satisfies ReferenceExpr,
        negate: false,
        condition: {
          type: FunctionType.CONDITION,
          name: 'IsNotEmpty',
          arguments: [] as ValueExpr[],
        } satisfies ConditionFunctionExpr,
      } satisfies PredicateTestExpr

      const json = {
        type: ExpressionType.VALIDATION,
        when: whenCondition,
        message: 'Invalid value',
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode
      const when = result.properties.when

      expect(result.id).toBeDefined()
      expect(when.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.when !== undefined).toBe(true)
    })

    it('should set submissionOnly flag when provided', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        submissionOnly: true,
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.submissionOnly).toBe(true)
    })

    it('should set submissionOnly to false when explicitly false', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        submissionOnly: false,
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.submissionOnly).toBe(false)
    })

    it('should default submissionOnly to false when undefined', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.properties.submissionOnly).toBe(false)
    })

    it('should set details when provided', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        details: { code: 'VALIDATION_001', severity: 'error' },
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.properties.details !== undefined).toBe(true)
      expect(result.properties.details).toEqual({
        code: 'VALIDATION_001',
        severity: 'error',
      })
    })

    it('should not set details when not provided', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.properties.details !== undefined).toBe(false)
    })

    it('should default message to empty string when not provided', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        message: '',
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.properties.message).toBe('')
    })

    it('should create a Validation expression with all properties', () => {
      const json = {
        type: ExpressionType.VALIDATION,
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        message: 'Custom error message',
        submissionOnly: true,
        details: { code: 'ERR_001' },
      } satisfies ValidationExpr

      const result = expressionFactory.create(json) as ValidationASTNode

      expect(result.properties.when !== undefined).toBe(true)
      expect(result.properties.message !== undefined).toBe(true)
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.details !== undefined).toBe(true)

      expect(result.properties.message).toBe('Custom error message')
      expect(result.properties.submissionOnly).toBe(true)
      expect(result.properties.details).toEqual({ code: 'ERR_001' })
    })
  })

  describe('createFunction', () => {
    it('should create a Function expression with Condition type', () => {
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsTrue',
        arguments: [] as ValueExpr[],
      }

      const result = expressionFactory.create(json) as FunctionASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(FunctionType.CONDITION)
      expect(result.raw).toBe(json)

      expect(result.properties.name).toBe('IsTrue')
      expect(result.properties.arguments).toBeDefined()
      expect(Array.isArray(result.properties.arguments)).toBe(true)
    })

    it('should create a Function expression with Transformer type', () => {
      const json = {
        type: FunctionType.TRANSFORMER,
        name: 'Uppercase',
        arguments: [] as ValueExpr[],
      } satisfies TransformerFunctionExpr

      const result = expressionFactory.create(json) as FunctionASTNode

      expect(result.expressionType).toBe(FunctionType.TRANSFORMER)
      expect(result.properties.name).toBe('Uppercase')
    })

    it('should create a Function expression with Effect type', () => {
      const json = {
        type: FunctionType.EFFECT,
        name: 'SaveData',
        arguments: [] as ValueExpr[],
      } satisfies EffectFunctionExpr

      const result = expressionFactory.create(json) as FunctionASTNode

      expect(result.expressionType).toBe(FunctionType.EFFECT)
      expect(result.properties.name).toBe('SaveData')
    })

    it('should create a Function expression with Generator type', () => {
      const json = {
        type: FunctionType.GENERATOR,
        name: 'GenerateID',
        arguments: [] as ValueExpr[],
      }

      const result = expressionFactory.create(json) as FunctionASTNode

      expect(result.expressionType).toBe(FunctionType.GENERATOR)
      expect(result.properties.name).toBe('GenerateID')
    })

    it('should transform literal arguments', () => {
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsEqual',
        arguments: ['value1', 42, true],
      } satisfies ConditionFunctionExpr

      const result = expressionFactory.create(json) as FunctionASTNode
      const args = result.properties.arguments

      expect(Array.isArray(args)).toBe(true)
      expect(args).toEqual(['value1', 42, true])
    })

    it('should transform expression arguments', () => {
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsEqual',
        arguments: [
          { type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr,
        ],
      } satisfies ConditionFunctionExpr

      const result = expressionFactory.create(json) as FunctionASTNode
      const args = result.properties.arguments

      expect(args).toHaveLength(2)

      args.forEach((arg: any) => {
        expect(arg.id).toBeDefined()
        expect(arg.type).toBe(ASTNodeType.EXPRESSION)
        expect(arg.expressionType).toBe(ExpressionType.REFERENCE)
      })
    })

    it('should transform mixed literal and expression arguments', () => {
      const json = {
        type: FunctionType.TRANSFORMER,
        name: 'Replace',
        arguments: [
          'searchString',
          { type: ExpressionType.REFERENCE, path: ['replacementValue'] } satisfies ReferenceExpr,
          true,
        ],
      } satisfies TransformerFunctionExpr

      const result = expressionFactory.create(json) as FunctionASTNode
      const args = result.properties.arguments

      expect(args).toHaveLength(3)
      expect(args[0]).toBe('searchString')
      expect(args[1]).toHaveProperty('id')
      expect(args[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[2]).toBe(true)
    })

    it('should handle nested function arguments', () => {
      const json = {
        type: FunctionType.CONDITION,
        name: 'And',
        arguments: [
          {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [{ type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr],
          } satisfies ConditionFunctionExpr,
          {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [{ type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr],
          } satisfies ConditionFunctionExpr,
        ],
      } satisfies ConditionFunctionExpr

      const result = expressionFactory.create(json) as FunctionASTNode

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

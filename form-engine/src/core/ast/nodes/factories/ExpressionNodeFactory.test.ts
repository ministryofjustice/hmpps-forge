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

      const result = expressionFactory.create(json)

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.REFERENCE)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
      expect(result.properties.has('path')).toBe(true)
    })

    it('should route to createFormat for Format expressions', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: 'Hello %1',
        args: ['World'],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.FORMAT)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
      expect(result.properties.has('text')).toBe(true)
      expect(result.properties.has('args')).toBe(true)
    })

    it('should route to createPipeline for Pipeline expressions', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [{ name: 'uppercase' }],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json)

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

      const result = expressionFactory.create(json)

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

      const result = expressionFactory.create(json)

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

      const result = expressionFactory.create(json)

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
        text: 'Hello %1, welcome to %2',
        args: ['World', 'Earth'],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.FORMAT)
      expect(result.raw).toBe(json)

      expect(result.properties.has('text')).toBe(true)
      expect(result.properties.get('text')).toBe('Hello %1, welcome to %2')

      expect(result.properties.has('args')).toBe(true)
      const args = result.properties.get('args')
      expect(Array.isArray(args)).toBe(true)
      expect(args).toEqual(['World', 'Earth'])
    })

    it('should create a Format expression with single placeholder', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: 'address_%1_street',
        args: ['123'],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      expect(result.properties.get('text')).toBe('address_%1_street')

      const args = result.properties.get('args')
      expect(args).toHaveLength(1)
      expect(args[0]).toBe('123')
    })

    it('should create a Format expression with expression arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: 'Item %1',
        args: [{ type: ExpressionType.REFERENCE, path: ['user', 'id'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      const args = result.properties.get('args')
      expect(args).toHaveLength(1)

      expect(args[0]).toHaveProperty('id')
      expect(args[0]).toHaveProperty('type')
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[0].expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should create a Format expression with multiple expression arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: '%1_%2_%3',
        args: [
          { type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr,
          { type: ExpressionType.REFERENCE, path: ['field3'] } satisfies ReferenceExpr,
        ],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      const args = result.properties.get('args')
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
        text: 'user_%1_%2',
        args: ['prefix', { type: ExpressionType.REFERENCE, path: ['userId'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      const args = result.properties.get('args')
      expect(args).toHaveLength(2)

      expect(args[0]).toBe('prefix')

      expect(args[1]).toHaveProperty('id')
      expect(args[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[1].expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should handle Format expression with HTML in text', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: '<h3>This is item %1</h3>',
        args: [{ type: ExpressionType.REFERENCE, path: ['itemName'] } satisfies ReferenceExpr],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      expect(result.properties.get('text')).toBe('<h3>This is item %1</h3>')

      const args = result.properties.get('args')
      expect(args).toHaveLength(1)
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create a Format expression with nested expression arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: 'Result: %1',
        args: [
          {
            type: ExpressionType.PIPELINE,
            input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
            steps: [{ name: 'uppercase' }],
          } satisfies PipelineExpr,
        ],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      const args = result.properties.get('args')
      expect(args).toHaveLength(1)

      expect(args[0].id).toBeDefined()
      expect(args[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(args[0].expressionType).toBe(ExpressionType.PIPELINE)
    })

    it('should handle Format expression with empty args array', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: 'No placeholders here',
        args: [] as any,
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      expect(result.properties.get('text')).toBe('No placeholders here')

      const args = result.properties.get('args')
      expect(Array.isArray(args)).toBe(true)
      expect(args).toHaveLength(0)
    })

    it('should handle Format expression with numeric literal arguments', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: 'Page %1 of %2',
        args: [1, 10],
      } satisfies FormatExpr

      const result = expressionFactory.create(json)

      const args = result.properties.get('args')
      expect(args).toEqual([1, 10])
    })

    it('should generate unique node IDs for Format expressions', () => {
      const json = {
        type: ExpressionType.FORMAT,
        text: 'Item %1',
        args: ['test'],
      } satisfies FormatExpr

      const result1 = expressionFactory.create(json)
      const result2 = expressionFactory.create(json)

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

      const result = expressionFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.REFERENCE)
      expect(result.properties.has('path')).toBe(true)

      const path = result.properties.get('path')
      expect(Array.isArray(path)).toBe(true)
      expect(path).toEqual(['field'])

      expect(result.raw).toBe(json)
    })

    it('should create a Reference expression with nested path', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['data', 'user', 'name'],
      } satisfies ReferenceExpr

      const result = expressionFactory.create(json)

      const path = result.properties.get('path')
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

      const result = expressionFactory.create(json)

      const path = result.properties.get('path')
      expect(Array.isArray(path)).toBe(true)
      expect(path).toHaveLength(2)
      expect(path[0]).toBe('items')

      // Second segment should be transformed to an AST node
      expect(path[1]).toHaveProperty('id')
      expect(path[1]).toHaveProperty('type')
      expect(path[1].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle non-array path values', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: 'simpleString',
      }

      const result = expressionFactory.create(json)
      const path = result.properties.get('path')

      expect(path).toBe('simpleString')
    })

    it('should generate unique node IDs', () => {
      const json = {
        type: ExpressionType.REFERENCE,
        path: ['field'],
      } satisfies ReferenceExpr

      const result1 = expressionFactory.create(json)
      const result2 = expressionFactory.create(json)

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
        steps: [{ name: 'trim' }, { name: 'uppercase' }],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.PIPELINE)
      expect(result.raw).toBe(json)

      expect(result.properties.has('input')).toBe(true)
      expect(result.properties.has('steps')).toBe(true)
    })

    it('should transform input using real nodeFactory', () => {
      const inputJson = { type: ExpressionType.REFERENCE, path: ['name'] } satisfies ReferenceExpr
      const json = {
        type: ExpressionType.PIPELINE,
        input: inputJson,
        steps: [{ name: 'trim' }],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json)
      const input = result.properties.get('input')

      expect(input.type).toBe(ASTNodeType.EXPRESSION)
      expect(input.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should preserve step names and transform step arguments', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [
          { name: 'pad', args: [10, '0'] },
          { name: 'substring', args: [0, 5] },
        ],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json)

      const steps = result.properties.get('steps')
      expect(Array.isArray(steps)).toBe(true)
      expect(steps).toHaveLength(2)

      expect(steps[0].name).toBe('pad')
      expect(steps[0].args).toEqual([10, '0'])

      expect(steps[1].name).toBe('substring')
      expect(steps[1].args).toEqual([0, 5])
    })

    it('should transform step arguments that are expressions', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [
          {
            name: 'replace',
            args: [
              'old',
              { type: ExpressionType.REFERENCE, path: ['replacement'] } satisfies ReferenceExpr, // Expression argument
            ],
          },
        ],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json)

      const steps = result.properties.get('steps')
      expect(steps).toHaveLength(1)
      expect(steps[0].name).toBe('replace')
      expect(steps[0].args).toHaveLength(2)
      expect(steps[0].args[0]).toBe('old')

      // Second argument should be transformed to AST node
      expect(steps[0].args[1]).toHaveProperty('id')
      expect(steps[0].args[1]).toHaveProperty('type')
      expect(steps[0].args[1].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle steps without arguments', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
        steps: [{ name: 'trim' }, { name: 'uppercase' }],
      } satisfies PipelineExpr

      const result = expressionFactory.create(json)
      const steps = result.properties.get('steps')

      expect(steps[0]).toEqual({ name: 'trim' })
      expect(steps[1]).toEqual({ name: 'uppercase' })
    })
  })

  describe('createCollection', () => {
    it('should create a Collection expression with collection and template', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [{ type: 'StructureType.Block', fields: [] as any }],
      }

      const result = expressionFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.COLLECTION)
      expect(result.raw).toBe(json)

      expect(result.properties.has('collection')).toBe(true)
      expect(result.properties.has('template')).toBe(true)
    })

    it('should transform collection data source', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['data', 'items'] },
        template: [] as any,
      }

      const result = expressionFactory.create(json)
      const collection = result.properties.get('collection')

      expect(collection.type).toBe(ASTNodeType.EXPRESSION)
      expect(collection.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should transform template blocks', () => {
      const templateBlock = { type: 'StructureType.Block', fields: [] as any }
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [templateBlock],
      }

      const result = expressionFactory.create(json)

      const template = result.properties.get('template')
      expect(Array.isArray(template)).toBe(true)
      expect(template).toHaveLength(1)

      expect(template[0]).toHaveProperty('id')
      expect(template[0]).toHaveProperty('type')
    })

    it('should transform multiple template blocks', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [
          { type: 'StructureType.Block', fields: [] as any },
          { type: 'StructureType.Block', fields: [] },
        ],
      }

      const result = expressionFactory.create(json)

      const template = result.properties.get('template')
      expect(template).toHaveLength(2)

      template.forEach((item: any) => {
        expect(item.id).toBeDefined()
        expect(item.type).toEqual(ASTNodeType.BLOCK)
      })
    })

    it('should create a Collection expression with fallback', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [] as any,
        fallback: [{ type: 'StructureType.Block', fields: [] as any }],
      }

      const result = expressionFactory.create(json)
      const fallback = result.properties.get('fallback')

      expect(result.properties.has('fallback')).toBe(true)
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

      const result = expressionFactory.create(json)

      expect(result.properties.has('collection')).toBe(true)
      expect(result.properties.has('template')).toBe(false)
      expect(result.properties.has('fallback')).toBe(false)
    })

    it('should handle collection without fallback', () => {
      const json = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['users'] },
        template: [] as any,
      }

      const result = expressionFactory.create(json)

      expect(result.properties.has('template')).toBe(true)
      expect(result.properties.has('fallback')).toBe(false)
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

      const result = expressionFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.VALIDATION)
      expect(result.raw).toBe(json)

      expect(result.properties.has('message')).toBe(true)
      expect(result.properties.get('message')).toBe('Field is required')
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

      const result = expressionFactory.create(json)
      const when = result.properties.get('when')

      expect(result.id).toBeDefined()
      expect(when.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.has('when')).toBe(true)
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

      const result = expressionFactory.create(json)

      expect(result.properties.has('submissionOnly')).toBe(true)
      expect(result.properties.get('submissionOnly')).toBe(true)
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

      const result = expressionFactory.create(json)

      expect(result.properties.has('submissionOnly')).toBe(true)
      expect(result.properties.get('submissionOnly')).toBe(false)
    })

    it('should not set submissionOnly when undefined', () => {
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

      const result = expressionFactory.create(json)

      expect(result.properties.has('submissionOnly')).toBe(false)
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

      const result = expressionFactory.create(json)

      expect(result.properties.has('details')).toBe(true)
      expect(result.properties.get('details')).toEqual({
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

      const result = expressionFactory.create(json)

      expect(result.properties.has('details')).toBe(false)
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

      const result = expressionFactory.create(json)

      expect(result.properties.get('message')).toBe('')
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

      const result = expressionFactory.create(json)

      expect(result.properties.has('when')).toBe(true)
      expect(result.properties.has('message')).toBe(true)
      expect(result.properties.has('submissionOnly')).toBe(true)
      expect(result.properties.has('details')).toBe(true)

      expect(result.properties.get('message')).toBe('Custom error message')
      expect(result.properties.get('submissionOnly')).toBe(true)
      expect(result.properties.get('details')).toEqual({ code: 'ERR_001' })
    })
  })

  describe('createFunction', () => {
    it('should create a Function expression with Condition type', () => {
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsTrue',
        arguments: [] as ValueExpr[],
      }

      const result = expressionFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(FunctionType.CONDITION)
      expect(result.raw).toBe(json)

      expect(result.properties.has('name')).toBe(true)
      expect(result.properties.get('name')).toBe('IsTrue')
      expect(result.properties.has('arguments')).toBe(true)
    })

    it('should create a Function expression with Transformer type', () => {
      const json = {
        type: FunctionType.TRANSFORMER,
        name: 'Uppercase',
        arguments: [] as ValueExpr[],
      } satisfies TransformerFunctionExpr

      const result = expressionFactory.create(json)

      expect(result.expressionType).toBe(FunctionType.TRANSFORMER)
      expect(result.properties.get('name')).toBe('Uppercase')
    })

    it('should create a Function expression with Effect type', () => {
      const json = {
        type: FunctionType.EFFECT,
        name: 'SaveData',
        arguments: [] as ValueExpr[],
      } satisfies EffectFunctionExpr

      const result = expressionFactory.create(json)

      expect(result.expressionType).toBe(FunctionType.EFFECT)
      expect(result.properties.get('name')).toBe('SaveData')
    })

    it('should create a Function expression with Generator type', () => {
      const json = {
        type: FunctionType.GENERATOR,
        name: 'GenerateID',
        arguments: [] as ValueExpr[],
      }

      const result = expressionFactory.create(json)

      expect(result.expressionType).toBe(FunctionType.GENERATOR)
      expect(result.properties.get('name')).toBe('GenerateID')
    })

    it('should transform literal arguments', () => {
      const json = {
        type: FunctionType.CONDITION,
        name: 'IsEqual',
        arguments: ['value1', 42, true],
      } satisfies ConditionFunctionExpr

      const result = expressionFactory.create(json)
      const args = result.properties.get('arguments')

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

      const result = expressionFactory.create(json)
      const args = result.properties.get('arguments')

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

      const result = expressionFactory.create(json)
      const args = result.properties.get('arguments')

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

      const result = expressionFactory.create(json)

      const args = result.properties.get('arguments')
      expect(args).toHaveLength(2)

      // Nested functions should be transformed to AST nodes
      args.forEach((arg: any) => {
        expect(arg).toHaveProperty('id')
        expect(arg).toHaveProperty('type')
        expect(arg.type).toBe(ASTNodeType.EXPRESSION)
        expect(arg.properties.has('name')).toBe(true)
        expect(arg.properties.has('arguments')).toBe(true)
      })
    })
  })
})

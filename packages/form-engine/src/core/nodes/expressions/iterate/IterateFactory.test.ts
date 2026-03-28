import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import type { IterateExpr, PredicateTestExpr, ReferenceExpr } from '@form-engine/form/types/expressions.type'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  IteratorType,
  PredicateType,
  StructureType,
} from '@form-engine/form/types/enums'
import { isTemplateNode } from '@form-engine/core/typeguards/nodes'
import { TemplateNode } from '@form-engine/core/types/template.type'
import TemplateFactory from '@form-engine/core/nodes/template/TemplateFactory'
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
      const result = iterateFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.ITERATE)
      expect(result.raw).toBe(json)
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
      const result = iterateFactory.create(json)

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
      const result = iterateFactory.create(json)

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
      const result = iterateFactory.create(json)

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
      const result = iterateFactory.create(json)

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
      const result = iterateFactory.create(json)
      const instantiatedTemplate = TemplateFactory.instantiate(result.properties.iterator.yieldTemplate!) as {
        properties: { value?: unknown }
      }

      // Assert — value is NOT set; AddSelfValueToFields runs at runtime in registerRuntimeNodesBatch
      expect(instantiatedTemplate.properties.value).toBeUndefined()
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
      const result = iterateFactory.create(json)
      const instantiatedTemplate = TemplateFactory.instantiate(result.properties.iterator.yieldTemplate!) as {
        properties: { label: { properties: { path: unknown[] } } }
      }

      // Assert — @self is preserved; ResolveSelfReferences runs at runtime in registerRuntimeNodesBatch
      expect(instantiatedTemplate.properties.label.properties.path).toEqual(['answers', '@self'])
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
      const result1 = iterateFactory.create(json)
      const result2 = iterateFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})

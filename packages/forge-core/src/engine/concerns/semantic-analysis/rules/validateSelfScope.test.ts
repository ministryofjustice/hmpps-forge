import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { TemplateValue } from '../../../chassis/contracts/ast/template.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import TemplateNodeIndex from '../../../chassis/compilation/ast/ast-state/TemplateNodeIndex'
import { NodeIDGenerator } from '../../../chassis/compilation/ast/ast-state/NodeIDGenerator'
import { compileTemplate } from '../../../chassis/compilation/ast/nodes/template'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateSelfScope } from './validateSelfScope'

const createContext = (nodes: readonly ASTNode[], edges: ReadonlyArray<[NodeId, NodeId]>): ASTValidationContext => {
  const byId = new Map<NodeId, ASTNode>(nodes.map(node => [node.id, node]))

  edges.forEach(([childId, parentId]) => {
    const child = byId.get(childId)
    const parent = byId.get(parentId)

    if (child !== undefined && parent !== undefined) {
      Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
    }
  })

  const nodeIndex = new ASTNodeIndex()
  nodes.forEach(node => nodeIndex.register(node.id, node))

  const templateNodeIndex = new TemplateNodeIndex()

  nodes.forEach(node => {
    const iterator = node.properties?.iterator as { yieldTemplate?: TemplateValue } | undefined

    if (iterator?.yieldTemplate !== undefined) {
      templateNodeIndex.registerTree(iterator.yieldTemplate, node)
    }
  })

  return {
    nodeIndex,
    templateNodeIndex,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

const iterateNodeWithYield = (yieldTemplate: TemplateValue): IterateASTNode =>
  ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
    .withProperty('input', ASTTestFactory.reference(['answers', 'items']))
    .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate })
    .build()

const errorMessages = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeReferenceScopeError).message)

describe('validateSelfScope', () => {
  describe('validateSelfScope()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when a Self reference sits in a field block property', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', '@self'])
      const field = ASTTestFactory.block('text', BlockType.FIELD)
        .withCode('field')
        .withProperty('validWhen', [reference])
        .build()
      const context = createContext([reference, field], [[reference.id, field.id]])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors for the bare @self path spelling', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['@self'])
      const field = ASTTestFactory.block('text', BlockType.FIELD)
        .withCode('field')
        .withProperty('validWhen', [reference])
        .build()
      const context = createContext([reference, field], [[reference.id, field.id]])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should ignore references that do not target @self', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', 'other'])
      const context = createContext([reference], [])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when a Self reference has no field block ancestor', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', '@self'])
      const step = ASTTestFactory.step().withProperty('title', reference).build()
      const context = createContext([reference, step], [[reference.id, step.id]])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['Self() reference used outside of a field block'])
    })

    it("should return an error when a Self reference sits inside the field's own code expression", () => {
      // Arrange
      const codeExpression = ASTTestFactory.expression(ExpressionType.PIPELINE)
        .withProperty('steps', [ASTTestFactory.reference(['answers', '@self'])])
        .build()
      const selfReference = (codeExpression.properties?.steps as ASTNode[])[0]
      const field = ASTTestFactory.block('text', BlockType.FIELD).withProperty('code', codeExpression).build()
      const context = createContext(
        [selfReference, codeExpression, field],
        [
          [selfReference.id, codeExpression.id],
          [codeExpression.id, field.id],
        ],
      )

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(["Self() cannot be used within the field's code expression"])
    })

    it('should return no errors when an iterator template holds a Self reference inside a template field block', () => {
      // Arrange
      const templateField = ASTTestFactory.block('text', BlockType.FIELD)
        .withCode('field')
        .withProperty('validWhen', [ASTTestFactory.reference(['answers', '@self'])])
        .build()
      const template = compileTemplate(templateField, new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const context = createContext([iterate], [])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when an iterator template holds a Self reference outside any field block', () => {
      // Arrange
      const templateBlock = ASTTestFactory.block('inset-text', BlockType.BASIC)
        .withProperty('content', ASTTestFactory.reference(['answers', '@self']))
        .build()
      const template = compileTemplate(templateBlock, new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const context = createContext([iterate], [])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['Self() reference used outside of a field block'])
    })

    it('should return no errors when the iterate node itself sits inside a field block', () => {
      // Arrange
      const templateBlock = ASTTestFactory.block('inset-text', BlockType.BASIC)
        .withProperty('content', ASTTestFactory.reference(['answers', '@self']))
        .build()
      const template = compileTemplate(templateBlock, new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const field = ASTTestFactory.block('text', BlockType.FIELD)
        .withCode('field')
        .withProperty('items', iterate)
        .build()
      const context = createContext([iterate, field], [[iterate.id, field.id]])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it("should return an error when an iterator template holds a Self reference inside a template field's code", () => {
      // Arrange
      const templateField = ASTTestFactory.block('text', BlockType.FIELD)
        .withProperty(
          'code',
          ASTTestFactory.expression(ExpressionType.PIPELINE)
            .withProperty('steps', [ASTTestFactory.reference(['answers', '@self'])])
            .build(),
        )
        .build()
      const template = compileTemplate(templateField, new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const context = createContext([iterate], [])

      // Act
      const errors = validateSelfScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(["Self() cannot be used within the field's code expression"])
    })
  })
})

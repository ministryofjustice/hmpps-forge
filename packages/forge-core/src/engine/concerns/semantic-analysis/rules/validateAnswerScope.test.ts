import { HookType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { MaterialisedASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
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
import { validateAnswerScope } from './validateAnswerScope'

const createContext = (
  nodes: readonly MaterialisedASTNode[],
  edges: ReadonlyArray<[NodeId, NodeId]>,
): ASTValidationContext => {
  const byId = new Map<NodeId, MaterialisedASTNode>(nodes.map(node => [node.id, node]))

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
    .withProperty('input', ASTTestFactory.reference(['data', 'items']))
    .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate })
    .build()

const errorMessages = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeReferenceScopeError).message)

const expectedMessage = 'Answer() cannot be used in an onAccess hook: answer preparation runs after access hooks'

describe('validateAnswerScope', () => {
  describe('validateAnswerScope()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when an answer reference is outside a hook', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', 'email'])
      const step = ASTTestFactory.step().withProperty('title', reference).build()
      const context = createContext([reference, step], [[reference.id, step.id]])

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when an answer reference is in a submit hook', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', 'email'])
      const hook = ASTTestFactory.hook(HookType.SUBMIT).withProperty('when', reference).build()
      const context = createContext([reference, hook], [[reference.id, hook.id]])

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when a non-answer reference is in an access hook', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['data', 'email'])
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('when', reference).build()
      const context = createContext([reference, hook], [[reference.id, hook.id]])

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when a self reference is in an access hook', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', '@self'])
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('when', reference).build()
      const context = createContext([reference, hook], [[reference.id, hook.id]])

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when an answer reference is a direct child of an access hook', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', 'email'])
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('when', reference).build()
      const context = createContext([reference, hook], [[reference.id, hook.id]])

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([expectedMessage])
    })

    it('should return an error when an answer reference is nested deep in an access hook', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', 'email'])
      const pipeline = ASTTestFactory.pipelineExpression({ input: reference, steps: [] })
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('when', pipeline).build()
      const step = ASTTestFactory.step().withProperty('onAccess', [hook]).build()
      const context = createContext(
        [reference, pipeline, hook, step],
        [
          [reference.id, pipeline.id],
          [pipeline.id, hook.id],
          [hook.id, step.id],
        ],
      )

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([expectedMessage])
    })

    it('should return an error when an iterator template holds an answer reference inside an access hook', () => {
      // Arrange
      const template = compileTemplate(ASTTestFactory.reference(['answers', 'email']), new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('when', iterate).build()
      const context = createContext([iterate, hook], [[iterate.id, hook.id]])

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([expectedMessage])
    })

    it('should return no errors when an iterator template holds an answer reference outside a hook', () => {
      // Arrange
      const template = compileTemplate(ASTTestFactory.reference(['answers', 'email']), new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const context = createContext([iterate], [])

      // Act
      const errors = validateAnswerScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })
  })
})

import { HookType, BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
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
import { validateOutcomeScope } from './validateOutcomeScope'

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

const createOutcome = (): ASTNode => ASTTestFactory.redirectOutcome({ goto: '/next' })

describe('validateOutcomeScope', () => {
  describe('validateOutcomeScope()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when an outcome is in an access hook next array', () => {
      // Arrange
      const outcome = createOutcome()
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('next', [outcome]).build()
      const context = createContext([outcome, hook], [[outcome.id, hook.id]])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when an outcome is in a submit hook onValid next array', () => {
      // Arrange
      const outcome = createOutcome()
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('onValid', { next: [outcome] })
        .build()
      const context = createContext([outcome, hook], [[outcome.id, hook.id]])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when an outcome is in a submit hook onInvalid next array', () => {
      // Arrange
      const outcome = createOutcome()
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('onInvalid', { next: [outcome] })
        .build()
      const context = createContext([outcome, hook], [[outcome.id, hook.id]])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when the parent is not a hook', () => {
      // Arrange
      const outcome = createOutcome()
      const block = ASTTestFactory.block('text', BlockType.FIELD).withProperty('defaultValue', outcome).build()
      const context = createContext([outcome, block], [[outcome.id, block.id]])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['Outcomes can only be used inside a hook (onAccess or onSubmission)'])
    })

    it('should return an error when the parent is a hook but the outcome is absent from its next arrays', () => {
      // Arrange
      const outcome = createOutcome()
      const hook = ASTTestFactory.hook(HookType.SUBMIT).withProperty('onValid', { next: [] }).build()
      const context = createContext([outcome, hook], [[outcome.id, hook.id]])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['Outcomes can only be used inside a hook (onAccess or onSubmission)'])
    })

    it('should return an error when the outcome has no parent', () => {
      // Arrange
      const outcome = createOutcome()
      const context = createContext([outcome], [])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['Outcomes can only be used inside a hook (onAccess or onSubmission)'])
    })

    it('should return an error when an iterator template holds an outcome and the iterate is outside a hook', () => {
      // Arrange
      const template = compileTemplate(createOutcome(), new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const context = createContext([iterate], [])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['Outcomes can only be used inside a hook (onAccess or onSubmission)'])
    })

    it('should return no errors when an iterator template holds an outcome and the iterate is inside a hook', () => {
      // Arrange
      const template = compileTemplate(createOutcome(), new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('next', [iterate]).build()
      const context = createContext([iterate, hook], [[iterate.id, hook.id]])

      // Act
      const errors = validateOutcomeScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })
  })
})

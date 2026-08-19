import { HookType, BlockType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
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

  return {
    nodeIndex,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

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
  })
})

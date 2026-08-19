import { HookType, BlockType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateHookScope } from './validateHookScope'

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

describe('validateHookScope', () => {
  describe('validateHookScope()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when an access hook is in a step onAccess array', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS).build()
      const step = ASTTestFactory.step().withProperty('onAccess', [hook]).build()
      const context = createContext([hook, step], [[hook.id, step.id]])

      // Act
      const errors = validateHookScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when a submit hook is in a step onSubmission array', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.SUBMIT).build()
      const step = ASTTestFactory.step().withProperty('onSubmission', [hook]).build()
      const context = createContext([hook, step], [[hook.id, step.id]])

      // Act
      const errors = validateHookScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when an access hook is in a journey onAccess array', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS).build()
      const journey = ASTTestFactory.journey().withProperty('onAccess', [hook]).build()
      const context = createContext([hook, journey], [[hook.id, journey.id]])

      // Act
      const errors = validateHookScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when the parent is neither a step nor a journey', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS).build()
      const block = ASTTestFactory.block('text', BlockType.FIELD).withProperty('defaultValue', hook).build()
      const context = createContext([hook, block], [[hook.id, block.id]])

      // Act
      const errors = validateHookScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Hooks can only be defined in onAccess (steps, journeys) or onSubmission (steps) arrays',
      ])
    })

    it('should return an error when a submit hook sits under a journey onSubmission key', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.SUBMIT).build()
      const journey = ASTTestFactory.journey().withProperty('onSubmission', [hook]).build()
      const context = createContext([hook, journey], [[hook.id, journey.id]])

      // Act
      const errors = validateHookScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Hooks can only be defined in onAccess (steps, journeys) or onSubmission (steps) arrays',
      ])
    })

    it('should return an error when the parent is a step but the hook is absent from its arrays', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS).build()
      const step = ASTTestFactory.step().withProperty('onAccess', []).build()
      const context = createContext([hook, step], [[hook.id, step.id]])

      // Act
      const errors = validateHookScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Hooks can only be defined in onAccess (steps, journeys) or onSubmission (steps) arrays',
      ])
    })

    it('should return an error when the hook has no parent', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS).build()
      const context = createContext([hook], [])

      // Act
      const errors = validateHookScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Hooks can only be defined in onAccess (steps, journeys) or onSubmission (steps) arrays',
      ])
    })
  })
})

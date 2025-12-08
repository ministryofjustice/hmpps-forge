import { ActionTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { TransitionType, FunctionType, LogicType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import { ThunkResult } from '@form-engine/core/ast/thunks/types'
import ActionTransitionHandler from './ActionTransitionHandler'

const mockMetadata = () => ({ source: 'test', timestamp: Date.now() })

describe('ActionTransitionHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return executed: false when when predicate returns false', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'lookupAddress')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          if (nodeId === whenPredicate.id) {
            return { value: false, metadata: mockMetadata() }
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: false })
    })

    it('should return executed: true and run effects when when predicate returns true', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'lookupAddress')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockEffectFn = { name: 'lookupAddress', evaluate: jest.fn() }
      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['lookupAddress', mockEffectFn]]),
      })

      const invokedIds: string[] = []
      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          invokedIds.push(nodeId)

          if (nodeId === whenPredicate.id) {
            return { value: true, metadata: mockMetadata() }
          }

          if (nodeId === effect.id) {
            return { value: { effectName: 'lookupAddress', args: [], nodeId: effect.id }, metadata: mockMetadata() }
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: true })
      expect(invokedIds).toContain(whenPredicate.id)
      expect(invokedIds).toContain(effect.id)
      expect(mockEffectFn.evaluate).toHaveBeenCalled()
    })

    it('should not invoke effects when when predicate fails', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'lookupAddress')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const invokedIds: string[] = []
      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          invokedIds.push(nodeId)

          if (nodeId === whenPredicate.id) {
            return { value: false, metadata: mockMetadata() }
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(invokedIds).toContain(whenPredicate.id)
      expect(invokedIds).not.toContain(effect.id)
    })

    it('should return executed: false when when predicate evaluation errors', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'lookupAddress')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          if (nodeId === whenPredicate.id) {
            return {
              error: {
                type: 'EVALUATION_FAILED' as const,
                nodeId: whenPredicate.id,
                message: 'Predicate evaluation failed',
              },
              metadata: mockMetadata(),
            } as ThunkResult
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: false })
    })

    it('should execute multiple effects when when predicate passes', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect1')
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect2')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect1, effect2])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockEffectFn1 = { name: 'effect1', evaluate: jest.fn() }
      const mockEffectFn2 = { name: 'effect2', evaluate: jest.fn() }
      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([
          ['effect1', mockEffectFn1],
          ['effect2', mockEffectFn2],
        ]),
      })

      const invokedIds: string[] = []
      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          invokedIds.push(nodeId)

          if (nodeId === whenPredicate.id) {
            return { value: true, metadata: mockMetadata() }
          }

          if (nodeId === effect1.id) {
            return { value: { effectName: 'effect1', args: [], nodeId: effect1.id }, metadata: mockMetadata() }
          }

          if (nodeId === effect2.id) {
            return { value: { effectName: 'effect2', args: [], nodeId: effect2.id }, metadata: mockMetadata() }
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: true })
      expect(invokedIds).toContain(effect1.id)
      expect(invokedIds).toContain(effect2.id)
      expect(mockEffectFn1.evaluate).toHaveBeenCalled()
      expect(mockEffectFn2.evaluate).toHaveBeenCalled()
    })

    it('should return executed: true with empty effects array when when passes', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          if (nodeId === whenPredicate.id) {
            return { value: true, metadata: mockMetadata() }
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: true })
    })

    it('should continue with remaining effects when one effect evaluation fails', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const failingEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'failingEffect')
      const successEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'successEffect')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [failingEffect, successEffect])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockSuccessEffectFn = { name: 'successEffect', evaluate: jest.fn() }
      const mockContext = createMockContext({
        mockRegisteredFunctions: new Map([['successEffect', mockSuccessEffectFn]]),
      })

      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          if (nodeId === whenPredicate.id) {
            return { value: true, metadata: mockMetadata() }
          }

          if (nodeId === failingEffect.id) {
            return {
              error: {
                type: 'EVALUATION_FAILED' as const,
                nodeId: failingEffect.id,
                message: 'Effect failed',
              },
              metadata: mockMetadata(),
            } as ThunkResult
          }

          if (nodeId === successEffect.id) {
            return {
              value: { effectName: 'successEffect', args: [], nodeId: successEffect.id },
              metadata: mockMetadata(),
            }
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: true })
      expect(mockSuccessEffectFn.evaluate).toHaveBeenCalled()
    })

    it('should return executed: false when when property is not an AST node', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'lookupAddress')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', null)
        .withProperty('effects', [effect])
        .build() as unknown as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: false })
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
    })
  })
})

import { LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { TransitionType, FunctionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import LoadTransitionHandler from './LoadTransitionHandler'

describe('LoadTransitionHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return empty effects when transition has no effects', async () => {
      // Arrange
      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const invoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, invoker)

      // Assert
      expect(result.value).toEqual({ effects: [] })
    })

    it('should capture single effect and return it', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadUserData')

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const capturedEffect = { effectName: 'loadUserData', args: [] as any, nodeId: effect.id }
      const mockInvoker = createMockInvoker({
        invokeImpl: async () => ({
          value: capturedEffect,
          metadata: { source: 'EffectHandler', timestamp: Date.now() },
        }),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
      expect(mockInvoker.invoke).toHaveBeenCalledWith(effect.id, mockContext)
      expect(result.value?.effects).toHaveLength(1)
      expect(result.value?.effects[0]).toEqual(capturedEffect)
    })

    it('should capture all effects and return them when transition has multiple effects', async () => {
      // Arrange
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadUserData')
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadConfiguration')
      const effect3 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadPermissions')

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect1, effect2, effect3])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const invocationOrder: string[] = []
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          invocationOrder.push(nodeId)

          return {
            value: { effectName: 'effect', args: [], nodeId },
            metadata: { source: 'EffectHandler', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
      expect(invocationOrder).toEqual([effect1.id, effect2.id, effect3.id])
      expect(result.value?.effects).toHaveLength(3)
    })

    it('should return captured effects without committing them', async () => {
      // Arrange
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect1')
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect2')

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect1, effect2])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      // Mock functions should NOT be called - effects are returned, not committed
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
        invokeImpl: async (nodeId: string) => {
          invokedIds.push(nodeId)

          if (nodeId === effect1.id) {
            return {
              value: { effectName: 'effect1', args: [], nodeId: effect1.id },
              metadata: { source: 'EffectHandler', timestamp: Date.now() },
            }
          }

          if (nodeId === effect2.id) {
            return {
              value: { effectName: 'effect2', args: [], nodeId: effect2.id },
              metadata: { source: 'EffectHandler', timestamp: Date.now() },
            }
          }

          return { value: undefined, metadata: { source: 'test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      // Both effects should be captured
      expect(invokedIds).toContain(effect1.id)
      expect(invokedIds).toContain(effect2.id)

      // Effects should be returned, NOT committed
      expect(result.value?.effects).toHaveLength(2)
      expect(result.value?.effects).toContainEqual({ effectName: 'effect1', args: [], nodeId: effect1.id })
      expect(result.value?.effects).toContainEqual({ effectName: 'effect2', args: [], nodeId: effect2.id })

      // Effect functions should NOT have been called (LifecycleCoordinator commits them)
      expect(mockEffectFn1.evaluate).not.toHaveBeenCalled()
      expect(mockEffectFn2.evaluate).not.toHaveBeenCalled()
    })

    it('should filter out failed effects and return only successful ones', async () => {
      // Arrange
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'failingEffect')
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'successEffect')

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect1, effect2])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: effect1.id,
            message: 'Effect failed',
          },
          metadata: { source: 'EffectHandler', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: { effectName: 'successEffect', args: [], nodeId: effect2.id },
          metadata: { source: 'EffectHandler', timestamp: Date.now() },
        })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(2)
      expect(result.value?.effects).toHaveLength(1)
      expect(result.value?.effects[0]).toEqual({ effectName: 'successEffect', args: [], nodeId: effect2.id })
    })

    it('should return empty effects without invoking any when effects property is undefined', async () => {
      // Arrange
      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', undefined)
        .build() as any

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).not.toHaveBeenCalled()
      expect(result.value).toEqual({ effects: [] })
    })
  })
})

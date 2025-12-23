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
    it('should return executed: true when transition has no effects', async () => {
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
      expect(result.value).toEqual({ executed: true })
    })

    it('should execute single effect and return executed: true', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadUserData')

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async () => ({
          value: undefined,
          metadata: { source: 'EffectHandler', timestamp: Date.now() },
        }),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
      expect(mockInvoker.invoke).toHaveBeenCalledWith(effect.id, mockContext)
      expect(result.value?.executed).toBe(true)
    })

    it('should execute all effects sequentially when transition has multiple effects', async () => {
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
            value: undefined,
            metadata: { source: 'EffectHandler', timestamp: Date.now() },
          }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(3)
      expect(invocationOrder).toEqual([effect1.id, effect2.id, effect3.id])
      expect(result.value?.executed).toBe(true)
    })

    it('should push @transitionType to scope before executing effects', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect1')

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      let capturedTransitionType: string | undefined

      const mockInvoker = createMockInvoker({
        invokeImpl: async () => {
          // Capture transition type from scope (as EffectHandler would read it)
          const currentScope = mockContext.scope[mockContext.scope.length - 1] ?? {}
          capturedTransitionType = currentScope['@transitionType'] as string

          return { value: undefined, metadata: { source: 'test', timestamp: Date.now() } }
        },
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(capturedTransitionType).toBe('load')
    })

    it('should fail fast and return error when first effect fails', async () => {
      // Arrange
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'failingEffect')
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'successEffect')

      const transition = ASTTestFactory.transition(TransitionType.LOAD)
        .withProperty('effects', [effect1, effect2])
        .build() as LoadTransitionASTNode

      const handler = new LoadTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()
      mockInvoker.invoke.mockResolvedValueOnce({
        error: {
          type: 'EVALUATION_FAILED',
          nodeId: effect1.id,
          message: 'Effect failed',
        },
        metadata: { source: 'EffectHandler', timestamp: Date.now() },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - Should fail fast, second effect never invoked
      expect(mockInvoker.invoke).toHaveBeenCalledTimes(1)
      expect(result.error).toBeDefined()
      expect(result.error?.nodeId).toBe(effect1.id)
    })

    it('should return executed: true without invoking any when effects property is undefined', async () => {
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
      expect(result.value).toEqual({ executed: true })
    })
  })
})

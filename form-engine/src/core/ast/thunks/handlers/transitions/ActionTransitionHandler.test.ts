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

    it('should return executed: true and execute effects when when predicate returns true', async () => {
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
            return { value: true, metadata: mockMetadata() }
          }

          // Effects now execute immediately and return undefined
          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: true })
      expect(invokedIds).toContain(whenPredicate.id)
      expect(invokedIds).toContain(effect.id)
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

    it('should execute multiple effects sequentially when when predicate passes', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect1')
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect2')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect1, effect2])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()

      const invokedIds: string[] = []
      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          invokedIds.push(nodeId)

          if (nodeId === whenPredicate.id) {
            return { value: true, metadata: mockMetadata() }
          }

          // Effects execute immediately and return undefined
          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({ executed: true })
      expect(invokedIds).toContain(effect1.id)
      expect(invokedIds).toContain(effect2.id)
    })

    it('should return executed: true when when passes and no effects defined', async () => {
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

    it('should fail fast and return error when effect fails', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const failingEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'failingEffect')
      const successEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'successEffect')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [failingEffect, successEffect])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const invokedIds: string[] = []

      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          invokedIds.push(nodeId)

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

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert - should fail fast, second effect not executed
      expect(result.error).toBeDefined()
      expect(result.error?.nodeId).toBe(failingEffect.id)
      expect(invokedIds).not.toContain(successEffect.id)
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

    it('should push @transitionType to scope before executing effects', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(LogicType.TEST).build()
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'lookupAddress')

      const transition = ASTTestFactory.transition(TransitionType.ACTION)
        .withProperty('when', whenPredicate)
        .withProperty('effects', [effect])
        .build() as ActionTransitionASTNode

      const handler = new ActionTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      let capturedTransitionType: string | undefined

      const mockInvoker = createMockInvoker({
        invokeImpl: async nodeId => {
          if (nodeId === whenPredicate.id) {
            return { value: true, metadata: mockMetadata() }
          }

          if (nodeId === effect.id) {
            // Capture transition type from scope (as EffectHandler would read it)
            const currentScope = mockContext.scope[mockContext.scope.length - 1] ?? {}
            capturedTransitionType = currentScope['@transitionType'] as string

            return { value: undefined, metadata: mockMetadata() }
          }

          return { value: undefined, metadata: mockMetadata() }
        },
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(capturedTransitionType).toBe('action')
    })
  })
})

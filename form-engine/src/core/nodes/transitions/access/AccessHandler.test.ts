import { AccessTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { TransitionType, PredicateType, FunctionType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import AccessHandler from './AccessHandler'

describe('AccessHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    describe('when condition evaluation', () => {
      it('should return executed: true, outcome: continue when no when condition is defined', async () => {
        // Arrange
        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('continue')
        expect(result.value.redirect).toBeUndefined()
      })

      it('should return executed: true, outcome: continue when when condition evaluates to true', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(invoker.invoke).toHaveBeenCalledWith(whenPredicate.id, mockContext)
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('continue')
        expect(result.value.redirect).toBeUndefined()
      })

      it('should return executed: false, outcome: continue when when condition evaluates to false', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: false })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(false)
        expect(result.value.outcome).toBe('continue')
      })

      it('should return executed: false, outcome: continue when when condition evaluation errors (fail safe)', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'checkAccess', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker()
        invoker.invoke.mockResolvedValue({
          error: { type: 'EVALUATION_FAILED', nodeId: whenPredicate.id, message: 'Error' },
          metadata: { source: 'TestHandler', timestamp: Date.now() },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(false)
        expect(result.value.outcome).toBe('continue')
      })
    })

    describe('redirect evaluation', () => {
      it('should return outcome: redirect when redirect expression matches', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const redirectExpr = ASTTestFactory.expression(ExpressionType.NEXT)
          .withProperty('goto', '/login')
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .withProperty('redirect', [redirectExpr])
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            if (nodeId === whenPredicate.id) {
              return { value: true, metadata: { source: 'Test', timestamp: Date.now() } }
            }

            if (nodeId === redirectExpr.id) {
              return { value: '/login', metadata: { source: 'Test', timestamp: Date.now() } }
            }

            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('redirect')
        expect(result.value.redirect).toBe('/login')
      })

      it('should return first matching redirect from multiple redirect expressions', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const redirect1 = ASTTestFactory.expression(ExpressionType.NEXT)
          .withProperty('when', ASTTestFactory.predicate(PredicateType.TEST, {}))
          .withProperty('goto', '/conditional-redirect')
          .build()

        const redirect2 = ASTTestFactory.expression(ExpressionType.NEXT)
          .withProperty('goto', '/fallback')
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .withProperty('redirect', [redirect1, redirect2])
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            if (nodeId === whenPredicate.id) {
              return { value: true, metadata: { source: 'Test', timestamp: Date.now() } }
            }

            if (nodeId === redirect1.id) {
              return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
            }

            if (nodeId === redirect2.id) {
              return { value: '/fallback', metadata: { source: 'Test', timestamp: Date.now() } }
            }

            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.outcome).toBe('redirect')
        expect(result.value.redirect).toBe('/fallback')
      })

      it('should return outcome: continue when no redirect expressions defined', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('continue')
        expect(result.value.redirect).toBeUndefined()
      })
    })

    describe('error response evaluation', () => {
      it('should return outcome: error with status and static message when status is configured', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'itemExists', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'item']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .withProperty('status', 404)
          .withProperty('message', 'Item not found')
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('error')
        expect(result.value.status).toBe(404)
        expect(result.value.message).toBe('Item not found')
        expect(result.value.redirect).toBeUndefined()
      })

      it('should return outcome: error with status and evaluated message expression', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'canEdit', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'permissions']),
          condition,
          negate: false,
        })

        const messageExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
          .withProperty('template', 'Item %1 not found')
          .withProperty('arguments', ['123'])
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .withProperty('status', 403)
          .withProperty('message', messageExpr)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            if (nodeId === whenPredicate.id) {
              return { value: true, metadata: { source: 'Test', timestamp: Date.now() } }
            }

            if (nodeId === messageExpr.id) {
              return { value: 'Item 123 not found', metadata: { source: 'Test', timestamp: Date.now() } }
            }

            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('error')
        expect(result.value.status).toBe(403)
        expect(result.value.message).toBe('Item 123 not found')
        expect(result.value.redirect).toBeUndefined()
      })

      it('should not return status/message when when condition is false', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'itemExists', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'item']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .withProperty('status', 404)
          .withProperty('message', 'Item not found')
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: false })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(false)
        expect(result.value.outcome).toBe('continue')
        expect(result.value.status).toBeUndefined()
        expect(result.value.message).toBeUndefined()
      })

      it('should return undefined message when message expression evaluation errors', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'itemExists', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'item']),
          condition,
          negate: false,
        })

        const messageExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
          .withProperty('template', 'Error: %1')
          .withProperty('arguments', [])
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('when', whenPredicate)
          .withProperty('status', 500)
          .withProperty('message', messageExpr)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Mock when condition to return true, then message expression to return an error
        invoker.invoke
          .mockResolvedValueOnce({ value: true, metadata: { source: 'Test', timestamp: Date.now() } }) // when condition
          .mockResolvedValueOnce({
            error: { type: 'EVALUATION_FAILED', nodeId: messageExpr.id, message: 'Missing argument' },
            metadata: { source: 'Test', timestamp: Date.now() },
          }) // message expression

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('error')
        expect(result.value.status).toBe(500)
        expect(result.value.message).toBeUndefined()
      })
    })

    describe('effects evaluation', () => {
      it('should execute effects when when condition is true', async () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logAccessAttempt', [])
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('effects', [effect])
          .withProperty('when', whenPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()

        const invocationOrder: string[] = []
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            invocationOrder.push(nodeId)

            if (nodeId === whenPredicate.id) {
              return { value: true, metadata: { source: 'Test', timestamp: Date.now() } }
            }

            // Effect returns undefined (effects now execute immediately)
            if (nodeId === effect.id) {
              return {
                value: undefined,
                metadata: { source: 'EffectHandler', timestamp: Date.now() },
              }
            }

            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert - effect was executed
        expect(invocationOrder).toContain(effect.id)
        expect(result.value.executed).toBe(true)
        expect(result.value.outcome).toBe('continue')
      })

      it('should execute effects after when condition evaluation', async () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logAccessAttempt', [])
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const whenPredicate = ASTTestFactory.predicate(PredicateType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('effects', [effect])
          .withProperty('when', whenPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()

        const invocationOrder: string[] = []
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            invocationOrder.push(nodeId)

            return { value: true, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        await handler.evaluate(mockContext, invoker)

        // Assert - when condition should be invoked before effects
        const effectIndex = invocationOrder.indexOf(effect.id)
        const whenIndex = invocationOrder.indexOf(whenPredicate.id)
        expect(whenIndex).toBeLessThan(effectIndex)
      })

      it('should execute multiple effects sequentially', async () => {
        // Arrange
        const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect1', [])
        const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect2', [])

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('effects', [effect1, effect2])
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()

        const invocationOrder: string[] = []
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            invocationOrder.push(nodeId)

            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        await handler.evaluate(mockContext, invoker)

        // Assert - effects were executed in order
        expect(invocationOrder).toEqual([effect1.id, effect2.id])
      })

      it('should return error if effect fails', async () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'failingEffect', [])

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('effects', [effect])
          .build() as AccessTransitionASTNode

        const handler = new AccessHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker()
        invoker.invoke.mockResolvedValue({
          error: { type: 'EVALUATION_FAILED', nodeId: effect.id, message: 'Effect failed' },
          metadata: { source: 'Test', timestamp: Date.now() },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.error).toBeDefined()
        expect(result.error?.nodeId).toBe(effect.id)
      })
    })
  })
})

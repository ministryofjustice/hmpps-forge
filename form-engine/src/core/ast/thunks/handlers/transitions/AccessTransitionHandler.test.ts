import { AccessTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { TransitionType, LogicType, FunctionType, ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockContext, createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import AccessTransitionHandler from './AccessTransitionHandler'

describe('AccessTransitionHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    describe('guards evaluation', () => {
      it('should return passed: false with empty effects when no guards are defined (default denial)', async () => {
        // Arrange
        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(false)
        expect(result.value.redirect).toBeUndefined()
        expect(result.value.pendingEffects).toEqual([])
      })

      it('should return passed: false when guards predicate evaluates to true (denial matched)', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(invoker.invoke).toHaveBeenCalledWith(guardsPredicate.id, mockContext)
        expect(result.value.passed).toBe(false)
        expect(result.value.redirect).toBeUndefined()
        expect(result.value.pendingEffects).toEqual([])
      })

      it('should return passed: true when guards predicate evaluates to false (no denial)', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: false })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(true)
        expect(result.value.pendingEffects).toEqual([])
      })

      it('should return passed: true when guards predicate evaluation errors (fail open)', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'checkAccess', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker()
        invoker.invoke.mockResolvedValue({
          error: { type: 'EVALUATION_FAILED', nodeId: guardsPredicate.id, message: 'Error' },
          metadata: { source: 'TestHandler', timestamp: Date.now() },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(true)
        expect(result.value.pendingEffects).toEqual([])
      })
    })

    describe('redirect evaluation', () => {
      it('should evaluate redirect when guards match denial condition', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const redirectExpr = ASTTestFactory.expression(ExpressionType.NEXT)
          .withProperty('goto', '/login')
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .withProperty('redirect', [redirectExpr])
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            if (nodeId === guardsPredicate.id) {
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
        expect(result.value.passed).toBe(false)
        expect(result.value.redirect).toBe('/login')
      })

      it('should return first matching redirect from multiple redirect expressions', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const redirect1 = ASTTestFactory.expression(ExpressionType.NEXT)
          .withProperty('when', ASTTestFactory.predicate(LogicType.TEST, {}))
          .withProperty('goto', '/conditional-redirect')
          .build()

        const redirect2 = ASTTestFactory.expression(ExpressionType.NEXT)
          .withProperty('goto', '/fallback')
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .withProperty('redirect', [redirect1, redirect2])
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            if (nodeId === guardsPredicate.id) {
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
        expect(result.value.redirect).toBe('/fallback')
      })

      it('should return undefined redirect when no redirect expressions defined', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(false)
        expect(result.value.redirect).toBeUndefined()
      })
    })

    describe('error response evaluation', () => {
      it('should return status and static message when guards match denial', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'itemExists', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'item']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .withProperty('status', 404)
          .withProperty('message', 'Item not found')
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(false)
        expect(result.value.status).toBe(404)
        expect(result.value.message).toBe('Item not found')
        expect(result.value.redirect).toBeUndefined()
      })

      it('should return status and evaluated message expression when guards match denial', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'canEdit', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'permissions']),
          condition,
          negate: false,
        })

        const messageExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
          .withProperty('template', 'Item %1 not found')
          .withProperty('arguments', ['123'])
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .withProperty('status', 403)
          .withProperty('message', messageExpr)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            if (nodeId === guardsPredicate.id) {
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
        expect(result.value.passed).toBe(false)
        expect(result.value.status).toBe(403)
        expect(result.value.message).toBe('Item 123 not found')
        expect(result.value.redirect).toBeUndefined()
      })

      it('should not return status/message when guards do not match denial', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'itemExists', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'item']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .withProperty('status', 404)
          .withProperty('message', 'Item not found')
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: false })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(true)
        expect(result.value.status).toBeUndefined()
        expect(result.value.message).toBeUndefined()
      })

      it('should return undefined message when message expression evaluation errors', async () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'itemExists', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'item']),
          condition,
          negate: false,
        })

        const messageExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
          .withProperty('template', 'Error: %1')
          .withProperty('arguments', [])
          .build()

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('guards', guardsPredicate)
          .withProperty('status', 500)
          .withProperty('message', messageExpr)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker({ defaultValue: true })

        // Mock message expression to return an error
        invoker.invoke
          .mockResolvedValueOnce({ value: true, metadata: { source: 'Test', timestamp: Date.now() } }) // guards (denial matched)
          .mockResolvedValueOnce({
            error: { type: 'EVALUATION_FAILED', nodeId: messageExpr.id, message: 'Missing argument' },
            metadata: { source: 'Test', timestamp: Date.now() },
          }) // message expression

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(false)
        expect(result.value.status).toBe(500)
        expect(result.value.message).toBeUndefined()
      })
    })

    describe('effects evaluation', () => {
      it('should capture and return effects regardless of guards result', async () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logAccessAttempt', [])
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('effects', [effect])
          .withProperty('guards', guardsPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        // Mock effect function should NOT be called - effects are returned, not committed
        const mockEffectFn = { name: 'logAccessAttempt', evaluate: jest.fn() }
        const mockContext = createMockContext({
          mockRegisteredFunctions: new Map([['logAccessAttempt', mockEffectFn]]),
        })

        const invocationOrder: string[] = []
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            invocationOrder.push(nodeId)

            if (nodeId === guardsPredicate.id) {
              return { value: true, metadata: { source: 'Test', timestamp: Date.now() } }
            }

            // Effect node returns CapturedEffect
            if (nodeId === effect.id) {
              return {
                value: { effectName: 'logAccessAttempt', args: [], nodeId: effect.id },
                metadata: { source: 'EffectHandler', timestamp: Date.now() },
              }
            }

            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert - effect was captured and returned
        expect(invocationOrder).toContain(effect.id)
        expect(result.value.passed).toBe(false)
        expect(result.value.pendingEffects).toHaveLength(1)
        expect(result.value.pendingEffects[0]).toEqual({ effectName: 'logAccessAttempt', args: [], nodeId: effect.id })

        // Effect function should NOT have been called (LifecycleCoordinator commits them)
        expect(mockEffectFn.evaluate).not.toHaveBeenCalled()
      })

      it('should capture effects before guards evaluation', async () => {
        // Arrange
        const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logAccessAttempt', [])
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isAuthenticated', [])
        const guardsPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['data', 'user']),
          condition,
          negate: false,
        })

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('effects', [effect])
          .withProperty('guards', guardsPredicate)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()

        const invocationOrder: string[] = []
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            invocationOrder.push(nodeId)

            // Effect node returns CapturedEffect
            if (nodeId === effect.id) {
              return {
                value: { effectName: 'logAccessAttempt', args: [], nodeId: effect.id },
                metadata: { source: 'EffectHandler', timestamp: Date.now() },
              }
            }

            return { value: true, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        await handler.evaluate(mockContext, invoker)

        // Assert - effects should be invoked before guards
        const effectIndex = invocationOrder.indexOf(effect.id)
        const guardsIndex = invocationOrder.indexOf(guardsPredicate.id)
        expect(effectIndex).toBeLessThan(guardsIndex)
      })

      it('should capture and return multiple effects', async () => {
        // Arrange
        const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect1', [])
        const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect2', [])

        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .withProperty('effects', [effect1, effect2])
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        // Mock effect functions should NOT be called - effects are returned, not committed
        const mockEffectFn1 = { name: 'effect1', evaluate: jest.fn() }
        const mockEffectFn2 = { name: 'effect2', evaluate: jest.fn() }
        const mockContext = createMockContext({
          mockRegisteredFunctions: new Map([
            ['effect1', mockEffectFn1],
            ['effect2', mockEffectFn2],
          ]),
        })

        const invocationOrder: string[] = []
        const invoker = createMockInvoker({
          invokeImpl: async (nodeId: string) => {
            invocationOrder.push(nodeId)

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

            return { value: undefined, metadata: { source: 'Test', timestamp: Date.now() } }
          },
        })

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert - effects were captured and returned
        expect(invocationOrder).toEqual([effect1.id, effect2.id])
        expect(result.value.pendingEffects).toHaveLength(2)
        expect(result.value.pendingEffects).toContainEqual({ effectName: 'effect1', args: [], nodeId: effect1.id })
        expect(result.value.pendingEffects).toContainEqual({ effectName: 'effect2', args: [], nodeId: effect2.id })

        // Effect functions should NOT have been called (LifecycleCoordinator commits them)
        expect(mockEffectFn1.evaluate).not.toHaveBeenCalled()
        expect(mockEffectFn2.evaluate).not.toHaveBeenCalled()
      })

      it('should return empty effects array when no effects defined', async () => {
        // Arrange
        const transition = ASTTestFactory.transition(TransitionType.ACCESS)
          .build() as AccessTransitionASTNode

        const handler = new AccessTransitionHandler(transition.id, transition)

        const mockContext = createMockContext()
        const invoker = createMockInvoker()

        // Act
        const result = await handler.evaluate(mockContext, invoker)

        // Assert
        expect(result.value.passed).toBe(false)
        expect(result.value.pendingEffects).toEqual([])
      })
    })
  })
})

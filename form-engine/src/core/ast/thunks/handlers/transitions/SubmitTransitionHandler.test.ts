import { SubmitTransitionASTNode, NextASTNode } from '@form-engine/core/types/expressions.type'
import { TransitionType, ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createMockInvoker } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { PseudoNode } from '@form-engine/core/types/pseudoNodes.type'
import SubmitTransitionHandler from './SubmitTransitionHandler'

/**
 * Create a mock ThunkEvaluationContext for testing
 */
function createMockContext() {
  return {
    scope: [],
    global: {
      answers: {},
      data: {},
    },
    request: {
      params: {},
      query: {},
      post: {},
    },
    logger: {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    },
    metadataRegistry: {
      get: jest.fn().mockReturnValue(undefined),
    },
    nodeRegistry: {
      get: jest.fn().mockReturnValue(undefined),
      getAll: jest.fn().mockReturnValue(new Map()),
    },
  } as any
}

describe('SubmitTransitionHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should not execute when when-predicate returns false', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('when', whenPredicate)
        .withProperty('validate', false)
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.executed).toBe(false)
      expect(result.value?.validated).toBe(false)
    })

    it('should execute when when-predicate returns true', async () => {
      // Arrange
      const whenPredicate = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('when', whenPredicate)
        .withProperty('validate', false)
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.executed).toBe(true)
    })

    it('should execute when when-predicate is not present', async () => {
      // Arrange
      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.executed).toBe(true)
    })

    it('should not execute when guards-predicate returns false', async () => {
      // Arrange
      const guardsPredicate = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('guards', guardsPredicate)
        .withProperty('validate', false)
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: false })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.executed).toBe(false)
    })

    it('should execute when guards-predicate returns true', async () => {
      // Arrange
      const guardsPredicate = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('guards', guardsPredicate)
        .withProperty('validate', false)
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: true })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.executed).toBe(true)
    })

    it('should capture onAlways effects for skip-validation transition', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logSubmission')

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .withProperty('onAlways', {
          effects: [effect],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()

      // Mock invoker returns CapturedEffect when invoked for effect nodes
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          if (nodeId === effect.id) {
            return {
              value: { effectName: 'logSubmission', args: [], nodeId: effect.id },
              metadata: { source: 'EffectHandler', timestamp: Date.now() },
            }
          }

          return { value: undefined, metadata: { source: 'test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.pendingEffects).toContainEqual({
        effectName: 'logSubmission',
        args: [],
        nodeId: effect.id,
      })
      expect(result.value?.executed).toBe(true)
      expect(result.value?.validated).toBe(false)
    })

    it('should evaluate next expressions and return navigation target for skip-validation transition', async () => {
      // Arrange
      const nextExpr = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', '/success')
        .build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .withProperty('onAlways', {
          next: [nextExpr],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: '/success' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.next).toBe('/success')
    })

    it('should capture effects and evaluate next expressions for skip-validation transition', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'saveData')
      const nextExpr = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', '/next')
        .build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .withProperty('onAlways', {
          effects: [effect],
          next: [nextExpr],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          if (nodeId === effect.id) {
            return {
              value: { effectName: 'saveData', args: [], nodeId: effect.id },
              metadata: { source: 'EffectHandler', timestamp: Date.now() },
            }
          }

          if (nodeId === nextExpr.id) {
            return {
              value: '/next',
              metadata: { source: 'NextHandler', timestamp: Date.now() },
            }
          }

          return { value: undefined, metadata: { source: 'test', timestamp: Date.now() } }
        },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.pendingEffects).toContainEqual({
        effectName: 'saveData',
        args: [],
        nodeId: effect.id,
      })
      expect(result.value?.next).toBe('/next')
    })

    it('should capture onAlways and onValid effects for valid submission with validation enabled', async () => {
      // Arrange
      const alwaysEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'logAttempt')
      const validEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'saveData')

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('onAlways', {
          effects: [alwaysEffect],
        })
        .withProperty('onValid', {
          effects: [validEffect],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      // Mock a step node
      const stepNode = ASTTestFactory.step().build()

      // Mock a block node with a passing validation
      const blockNode = ASTTestFactory.block('text-input', 'field').build()

      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          // Mock block evaluation returning a passing validation
          if (nodeId === blockNode.id) {
            return {
              value: {
                properties: {
                  validate: [{ passed: true }],
                },
              },
              metadata: { source: 'BlockHandler', timestamp: Date.now() },
            }
          }

          // Mock effect node invocations returning CapturedEffect
          if (nodeId === alwaysEffect.id) {
            return {
              value: { effectName: 'logAttempt', args: [], nodeId: alwaysEffect.id },
              metadata: { source: 'EffectHandler', timestamp: Date.now() },
            }
          }

          if (nodeId === validEffect.id) {
            return {
              value: { effectName: 'saveData', args: [], nodeId: validEffect.id },
              metadata: { source: 'EffectHandler', timestamp: Date.now() },
            }
          }

          return {
            value: undefined,
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      const mockContext = {
        ...createMockContext(),
        metadataRegistry: {
          get: jest.fn().mockImplementation((nodeId: string, key: string) => {
            if (key === 'attachedToParentNode') {
              if (nodeId === transition.id) {
                return stepNode.id
              }

              if (nodeId === blockNode.id) {
                return stepNode.id
              }
            }

            return undefined
          }),
        },
        nodeRegistry: {
          get: jest.fn().mockImplementation((nodeId: string) => {
            if (nodeId === stepNode.id) {
              return stepNode
            }

            if (nodeId === blockNode.id) {
              return blockNode
            }

            return undefined
          }),
          getAll: jest.fn().mockReturnValue(
            new Map<NodeId, ASTNode | PseudoNode>([
              [stepNode.id, stepNode],
              [blockNode.id, blockNode],
            ]),
          ),
        },
        logger: {
          debug: jest.fn(),
          error: jest.fn(),
        },
      }

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.pendingEffects).toContainEqual({
        effectName: 'logAttempt',
        args: [],
        nodeId: alwaysEffect.id,
      })
      expect(result.value?.pendingEffects).toContainEqual({
        effectName: 'saveData',
        args: [],
        nodeId: validEffect.id,
      })
      expect(result.value?.validated).toBe(true)
      expect(result.value?.isValid).toBe(true)
    })

    it('should execute onValid branch for valid submission with validation enabled', async () => {
      // Arrange
      const validNext = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', '/success')
        .build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('onValid', {
          next: [validNext],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      // Mock a step node
      const stepNode = ASTTestFactory.step().build()

      // Mock a block node with a passing validation
      const blockNode = ASTTestFactory.block('text-input', 'field').build()

      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          // Mock block evaluation returning a passing validation
          if (nodeId === blockNode.id) {
            return {
              value: {
                properties: {
                  validate: [{ passed: true }],
                },
              },
              metadata: { source: 'BlockHandler', timestamp: Date.now() },
            }
          }

          // Mock Next expression evaluation
          if (nodeId === validNext.id) {
            return {
              value: '/success',
              metadata: { source: 'NextHandler', timestamp: Date.now() },
            }
          }

          return {
            value: undefined,
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      const mockContext = {
        ...createMockContext(),
        metadataRegistry: {
          get: jest.fn().mockImplementation((nodeId: string, key: string) => {
            if (key === 'attachedToParentNode') {
              if (nodeId === transition.id) {
                return stepNode.id
              }

              if (nodeId === blockNode.id) {
                return stepNode.id
              }
            }

            return undefined
          }),
        },
        nodeRegistry: {
          get: jest.fn().mockImplementation((nodeId: string) => {
            if (nodeId === stepNode.id) {
              return stepNode
            }

            if (nodeId === blockNode.id) {
              return blockNode
            }

            return undefined
          }),
          getAll: jest.fn().mockReturnValue(
            new Map<NodeId, ASTNode | PseudoNode>([
              [stepNode.id, stepNode],
              [blockNode.id, blockNode],
            ]),
          ),
        },
        logger: {
          debug: jest.fn(),
          error: jest.fn(),
        },
      }

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.next).toBe('/success')
      expect(result.value?.validated).toBe(true)
      expect(result.value?.isValid).toBe(true)
    })

    it('should execute onInvalid branch for invalid submission with validation enabled', async () => {
      // Arrange
      const invalidNext = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', '/error')
        .build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('onInvalid', {
          next: [invalidNext],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      // Mock a step node
      const stepNode = ASTTestFactory.step().build()

      // Mock a block node with a failed validation
      const blockNode = ASTTestFactory.block('text-input', 'field').build()

      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
          // Mock block evaluation returning a failed validation
          if (nodeId === blockNode.id) {
            return {
              value: {
                properties: {
                  validate: [{ passed: false, message: 'Field is required' }],
                },
              },
              metadata: { source: 'BlockHandler', timestamp: Date.now() },
            }
          }

          // Mock Next expression evaluation
          if (nodeId === invalidNext.id) {
            return {
              value: '/error',
              metadata: { source: 'NextHandler', timestamp: Date.now() },
            }
          }

          return {
            value: undefined,
            metadata: { source: 'test', timestamp: Date.now() },
          }
        },
      })

      const mockContext = {
        ...createMockContext(),
        metadataRegistry: {
          get: jest.fn().mockImplementation((nodeId: string, key: string) => {
            if (key === 'attachedToParentNode') {
              if (nodeId === transition.id) {
                return stepNode.id
              }

              if (nodeId === blockNode.id) {
                return stepNode.id
              }
            }

            return undefined
          }),
        },
        nodeRegistry: {
          get: jest.fn().mockImplementation((nodeId: string) => {
            if (nodeId === stepNode.id) {
              return stepNode
            }

            if (nodeId === blockNode.id) {
              return blockNode
            }

            return undefined
          }),
          getAll: jest.fn().mockReturnValue(
            new Map<NodeId, ASTNode | PseudoNode>([
              [stepNode.id, stepNode],
              [blockNode.id, blockNode],
            ]),
          ),
        },
        logger: {
          debug: jest.fn(),
          error: jest.fn(),
        },
      }

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.validated).toBe(true)
      expect(result.value?.isValid).toBe(false)
      expect(result.value?.next).toBe('/error')
      expect(mockInvoker.invoke).toHaveBeenCalledWith(invalidNext.id, mockContext)
    })

    it('should capture multiple effects', async () => {
      // Arrange
      const effect1 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect1')
      const effect2 = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'effect2')

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .withProperty('onAlways', {
          effects: [effect1, effect2],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({
        invokeImpl: async (nodeId: string) => {
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
      expect(result.value?.pendingEffects).toContainEqual({
        effectName: 'effect1',
        args: [],
        nodeId: effect1.id,
      })
      expect(result.value?.pendingEffects).toContainEqual({
        effectName: 'effect2',
        args: [],
        nodeId: effect2.id,
      })
      expect(result.value?.pendingEffects).toHaveLength(2)
    })

    it('should return first non-undefined next value from next expressions', async () => {
      // Arrange
      const next1 = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', '/first')
        .build()

      const next2 = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT)
        .withProperty('goto', '/second')
        .build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .withProperty('onAlways', {
          next: [next1, next2],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()
      mockInvoker.invoke
        .mockResolvedValueOnce({
          value: undefined,
          metadata: { source: 'NextHandler', timestamp: Date.now() },
        })
        .mockResolvedValueOnce({
          value: '/second',
          metadata: { source: 'NextHandler', timestamp: Date.now() },
        })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.next).toBe('/second')
    })

    it('should return undefined when no next expressions return a value', async () => {
      // Arrange
      const next = ASTTestFactory.expression<NextASTNode>(ExpressionType.NEXT).withProperty('goto', '/path').build()

      const transition = ASTTestFactory.transition(TransitionType.SUBMIT)
        .withProperty('validate', false)
        .withProperty('onAlways', {
          next: [next],
        })
        .build() as SubmitTransitionASTNode

      const handler = new SubmitTransitionHandler(transition.id, transition)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: undefined })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value?.next).toBeUndefined()
    })
  })
})

import { TransitionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import {
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  SubmitTransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { NodeId, AstNodeId } from '@form-engine/core/types/engine.type'
import { AccessTransitionResult } from '@form-engine/core/nodes/transitions/access/AccessHandler'
import { SubmitTransitionResult } from '@form-engine/core/nodes/transitions/submit/SubmitHandler'
import { ActionTransitionResult } from '@form-engine/core/nodes/transitions/action/ActionHandler'
import { ThunkInvocationAdapter, ThunkResult } from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import TransitionExecutor from './TransitionExecutor'

function createStep(options: {
  onAccess?: AccessTransitionASTNode[]
  onAction?: ActionTransitionASTNode[]
  onSubmission?: SubmitTransitionASTNode[]
}): StepASTNode {
  const builder = ASTTestFactory.step().withPath('/step-1').withTitle('Test Step')

  if (options.onAccess) {
    builder.withProperty('onAccess', options.onAccess)
  }

  if (options.onAction) {
    builder.withProperty('onAction', options.onAction)
  }

  if (options.onSubmission) {
    builder.withProperty('onSubmission', options.onSubmission)
  }

  return builder.build()
}

function createJourney(options: { onAccess?: AccessTransitionASTNode[] }): JourneyASTNode {
  const builder = ASTTestFactory.journey()
    .withProperty('path', '/journey')
    .withCode('test-journey')
    .withTitle('Test Journey')

  if (options.onAccess) {
    builder.withProperty('onAccess', options.onAccess)
  }

  return builder.build()
}

function setupExecutor(step: StepASTNode): {
  executor: TransitionExecutor
  context: jest.Mocked<ThunkEvaluationContext>
  invoker: jest.Mocked<ThunkInvocationAdapter>
  logger: { warn: jest.Mock; debug: jest.Mock; info: jest.Mock; error: jest.Mock }
} {
  const context = {
    nodeRegistry: {
      get: jest.fn().mockReturnValue(step),
    },
    global: {
      answers: {},
      data: {},
    },
  } as unknown as jest.Mocked<ThunkEvaluationContext>

  const invoker = {
    invoke: jest.fn(),
    invokeSync: jest.fn(),
  } as jest.Mocked<ThunkInvocationAdapter>

  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }

  const executor = new TransitionExecutor(logger as unknown as Console)

  return { executor, context, invoker, logger }
}

function createRuntimePlan(step: StepASTNode, options: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId: step.id,
    accessAncestorIds: [step.id],
    actionTransitionIds: (step.properties.onAction ?? []).map(transition => transition.id),
    submitTransitionIds: (step.properties.onSubmission ?? []).map(transition => transition.id),
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    renderAncestorIds: [],
    renderStepId: step.id,
    isRenderSync: false,
    isAnswerPrepareSync: false,
    isValidationSync: false,
    hasValidatingSubmitTransition: false,
    hasDomainValidation: false,
    ...options,
  }
}

function successResult<T>(value: T): ThunkResult<T> {
  return { value, metadata: { source: 'test', timestamp: Date.now() } }
}

function errorResult(message: string): ThunkResult {
  return {
    error: { type: 'EVALUATION_FAILED', nodeId: 'compile_ast:0' as NodeId, message },
    metadata: { source: 'test', timestamp: Date.now() },
  }
}

describe('TransitionExecutor', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('executeAccessTransitions()', () => {
    it('should return continue when ancestor has no transitions', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)

      // Act
      const result = await executor.executeAccessTransitions(step, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'continue' })
      expect(invoker.invoke).not.toHaveBeenCalled()
    })

    it('should invoke all transitions and return continue when all pass', async () => {
      // Arrange
      const access1 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const access2 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(successResult<AccessTransitionResult>({ executed: true, outcome: 'continue' }))

      // Act
      const result = await executor.executeAccessTransitions(step, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledWith(access1.id, context)
      expect(invoker.invoke).toHaveBeenCalledWith(access2.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should halt on redirect outcome', async () => {
      // Arrange
      const access1 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const access2 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(
        successResult<AccessTransitionResult>({ executed: true, outcome: 'redirect', redirect: '/login' }),
      )

      // Act
      const result = await executor.executeAccessTransitions(step, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should halt on error outcome', async () => {
      // Arrange
      const access = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStep({ onAccess: [access] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(
        successResult<AccessTransitionResult>({ executed: true, outcome: 'error', status: 403, message: 'Forbidden' }),
      )

      // Act
      const result = await executor.executeAccessTransitions(step, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'error', status: 403, message: 'Forbidden' })
    })

    it('should warn and skip when transition invocation errors', async () => {
      // Arrange
      const access1 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const access2 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker, logger } = setupExecutor(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === access1.id) {
          return errorResult('API timeout')
        }

        return successResult<AccessTransitionResult>({ executed: true, outcome: 'continue' })
      })

      // Act
      const result = await executor.executeAccessTransitions(step, invoker, context)

      // Assert
      expect(logger.warn).toHaveBeenCalledWith('Access transition error: API timeout')
      expect(invoker.invoke).toHaveBeenCalledWith(access2.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should skip non-executed transitions (when condition false)', async () => {
      // Arrange
      const access1 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const access2 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === access1.id) {
          return successResult<AccessTransitionResult>({ executed: false, outcome: 'continue' })
        }

        return successResult<AccessTransitionResult>({ executed: true, outcome: 'continue' })
      })

      // Act
      const result = await executor.executeAccessTransitions(step, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledWith(access2.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should work with journey ancestors', async () => {
      // Arrange
      const access = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const journey = createJourney({ onAccess: [access] })
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(successResult<AccessTransitionResult>({ executed: true, outcome: 'continue' }))

      // Act
      const result = await executor.executeAccessTransitions(journey, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledWith(access.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })
  })

  describe('executeActionTransitions()', () => {
    it('should return not-executed when step has no action transitions', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      // Act
      const result = await executor.executeActionTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false })
    })

    it('should return first executed action (first-match semantics)', async () => {
      // Arrange
      const action1 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
      const action2 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
      const step = createStep({ onAction: [action1, action2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === action1.id) {
          return successResult<ActionTransitionResult>({ executed: true })
        }

        return successResult<ActionTransitionResult>({ executed: false })
      })

      // Act
      const result = await executor.executeActionTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true })
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
      expect(invoker.invoke).not.toHaveBeenCalledWith(action2.id, expect.anything())
    })

    it('should skip non-matching actions and return not-executed', async () => {
      // Arrange
      const action1 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
      const action2 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
      const step = createStep({ onAction: [action1, action2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockResolvedValue(successResult<ActionTransitionResult>({ executed: false }))

      // Act
      const result = await executor.executeActionTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should skip action transitions that error', async () => {
      // Arrange
      const action1 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
      const action2 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
      const step = createStep({ onAction: [action1, action2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === action1.id) {
          return errorResult('Failed to evaluate')
        }

        return successResult<ActionTransitionResult>({ executed: true })
      })

      // Act
      const result = await executor.executeActionTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('executeSubmitTransitions()', () => {
    it('should return default when step has no submit transitions', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      // Act
      const result = await executor.executeSubmitTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false, validated: false, outcome: 'continue' })
    })

    it('should return first executed submit (first-match semantics)', async () => {
      // Arrange
      const submit1 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const submit2 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const step = createStep({ onSubmission: [submit1, submit2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      const submitResult: SubmitTransitionResult = {
        executed: true,
        validated: true,
        isValid: false,
        outcome: 'continue',
      }

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === submit1.id) {
          return successResult(submitResult)
        }

        return successResult<SubmitTransitionResult>({ executed: false, validated: false, outcome: 'continue' })
      })

      // Act
      const result = await executor.executeSubmitTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual(submitResult)
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
      expect(invoker.invoke).not.toHaveBeenCalledWith(submit2.id, expect.anything())
    })

    it('should return redirect result from submit transition', async () => {
      // Arrange
      const submit = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const step = createStep({ onSubmission: [submit] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      const submitResult: SubmitTransitionResult = {
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: 'next-step',
      }

      invoker.invoke.mockResolvedValue(successResult(submitResult))

      // Act
      const result = await executor.executeSubmitTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual(submitResult)
    })

    it('should skip non-matching submit transitions and return default', async () => {
      // Arrange
      const submit1 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const submit2 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const step = createStep({ onSubmission: [submit1, submit2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockResolvedValue(
        successResult<SubmitTransitionResult>({ executed: false, validated: false, outcome: 'continue' }),
      )

      // Act
      const result = await executor.executeSubmitTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false, validated: false, outcome: 'continue' })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should skip submit transitions that error', async () => {
      // Arrange
      const submit1 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const submit2 = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const step = createStep({ onSubmission: [submit1, submit2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === submit1.id) {
          return errorResult('Validation service down')
        }

        return successResult<SubmitTransitionResult>({
          executed: true,
          validated: false,
          outcome: 'redirect',
          redirect: 'next',
        })
      })

      // Act
      const result = await executor.executeSubmitTransitions(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, validated: false, outcome: 'redirect', redirect: 'next' })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('executeAccessLifecycle()', () => {
    function setupLifecycle(ancestors: (JourneyASTNode | StepASTNode)[]): {
      executor: TransitionExecutor
      context: jest.Mocked<ThunkEvaluationContext>
      invoker: jest.Mocked<ThunkInvocationAdapter>
      runtimePlan: StepRuntimePlan
    } {
      const accessAncestorIds = ancestors.map(a => a.id) as AstNodeId[]

      const context = {
        metadataRegistry: {
          get: jest.fn().mockImplementation((nodeId: NodeId, key: string) => {
            if (key === 'attachedToParentNode') {
              const index = accessAncestorIds.indexOf(nodeId as AstNodeId)

              if (index > 0) {
                return accessAncestorIds[index - 1]
              }
            }

            return undefined
          }),
        },
        nodeRegistry: {
          get: jest.fn().mockImplementation((nodeId: NodeId) => {
            return ancestors.find(a => a.id === nodeId)
          }),
        },
        global: {
          answers: {},
          data: {},
        },
      } as unknown as jest.Mocked<ThunkEvaluationContext>

      const invoker = {
        invoke: jest.fn(),
        invokeSync: jest.fn(),
      } as jest.Mocked<ThunkInvocationAdapter>

      const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
      const executor = new TransitionExecutor(logger as unknown as Console)
      const runtimePlan = createRuntimePlan(ancestors.at(-1)! as StepASTNode, {
        accessAncestorIds,
      })

      return { executor, context, invoker, runtimePlan }
    }

    it('should return continue when no ancestors have transitions', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker, runtimePlan } = setupLifecycle([step])

      // Act
      const result = await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'continue' })
      expect(invoker.invoke).not.toHaveBeenCalled()
    })

    it('should run access transitions for all ancestors in outer-to-inner order', async () => {
      // Arrange
      const journeyAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const stepAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

      const journey = createJourney({ onAccess: [journeyAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([journey, step])

      const invocationOrder: string[] = []
      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        invocationOrder.push(nodeId)

        return successResult<AccessTransitionResult>({ executed: true, outcome: 'continue' })
      })

      // Act
      await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(invocationOrder.indexOf(journeyAccess.id)).toBeLessThan(invocationOrder.indexOf(stepAccess.id))
    })

    it('should halt on redirect and not run subsequent ancestors', async () => {
      // Arrange
      const journeyAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const stepAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

      const journey = createJourney({ onAccess: [journeyAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([journey, step])

      invoker.invoke.mockResolvedValue(
        successResult<AccessTransitionResult>({ executed: true, outcome: 'redirect', redirect: '/login' }),
      )

      // Act
      const result = await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
      expect(invoker.invoke).not.toHaveBeenCalledWith(stepAccess.id, expect.anything())
    })

    it('should halt on error and not run subsequent ancestors', async () => {
      // Arrange
      const journeyAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const stepAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

      const journey = createJourney({ onAccess: [journeyAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([journey, step])

      invoker.invoke.mockResolvedValue(
        successResult<AccessTransitionResult>({ executed: true, outcome: 'error', status: 403 }),
      )

      // Act
      const result = await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(result.outcome).toBe('error')
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should run transitions across deeply nested hierarchy', async () => {
      // Arrange
      const outerAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const innerAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const stepAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

      const outerJourney = createJourney({ onAccess: [outerAccess] })
      const innerJourney = createJourney({ onAccess: [innerAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([outerJourney, innerJourney, step])

      invoker.invoke.mockResolvedValue(successResult<AccessTransitionResult>({ executed: true, outcome: 'continue' }))

      // Act
      const result = await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })
  })
})

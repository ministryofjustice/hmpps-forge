import { HookType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { AccessHookASTNode, ActionHookASTNode, SubmitHookASTNode } from '../../types/expressions.type'
import { NodeId, AstNodeId } from '../../types/engine.type'
import { AccessHookResult } from '../../nodes/hooks/access/AccessHandler'
import { SubmitHookResult } from '../../nodes/hooks/submit/SubmitHandler'
import { ActionHookResult } from '../../nodes/hooks/action/ActionHandler'
import { ThunkInvocationAdapter, ThunkResult } from '../../compilation/thunks/types'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import HookExecutor from './HookExecutor'

function createStep(options: {
  onAccess?: AccessHookASTNode[]
  onAction?: ActionHookASTNode[]
  onSubmission?: SubmitHookASTNode[]
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

function createJourney(options: { onAccess?: AccessHookASTNode[] }): JourneyASTNode {
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
  executor: HookExecutor
  context: Mocked<ThunkEvaluationContext>
  invoker: Mocked<ThunkInvocationAdapter>
  logger: { warn: Mock; debug: Mock; info: Mock; error: Mock }
} {
  const context = {
    nodeRegistry: {
      get: vi.fn().mockReturnValue(step),
    },
    global: {
      answers: {},
      data: {},
    },
  } as unknown as Mocked<ThunkEvaluationContext>

  const invoker = {
    invoke: vi.fn(),
    invokeSync: vi.fn(),
  } as Mocked<ThunkInvocationAdapter>

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const executor = new HookExecutor(logger as unknown as Console)

  return { executor, context, invoker, logger }
}

function createRuntimePlan(step: StepASTNode, options: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId: step.id,
    accessAncestorIds: [step.id],
    actionHookIds: (step.properties.onAction ?? []).map(hook => hook.id),
    submitHookIds: (step.properties.onSubmission ?? []).map(hook => hook.id),
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    renderAncestorIds: [],
    renderStepId: step.id,
    hasValidatingSubmitHook: false,
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

describe('HookExecutor', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('executeAccessHooks()', () => {
    it('should return continue when ancestor has no hooks', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)

      // Act
      const result = await executor.executeAccessHooks(step, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'continue' })
      expect(invoker.invoke).not.toHaveBeenCalled()
    })

    it('should invoke all hooks and return continue when all pass', async () => {
      // Arrange
      const access1 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const access2 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(successResult<AccessHookResult>({ executed: true, outcome: 'continue' }))

      // Act
      const result = await executor.executeAccessHooks(step, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledWith(access1.id, context)
      expect(invoker.invoke).toHaveBeenCalledWith(access2.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should halt on redirect outcome', async () => {
      // Arrange
      const access1 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const access2 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(
        successResult<AccessHookResult>({ executed: true, outcome: 'redirect', redirect: '/login' }),
      )

      // Act
      const result = await executor.executeAccessHooks(step, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should halt on error outcome', async () => {
      // Arrange
      const access = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStep({ onAccess: [access] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(
        successResult<AccessHookResult>({ executed: true, outcome: 'error', status: 403, message: 'Forbidden' }),
      )

      // Act
      const result = await executor.executeAccessHooks(step, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'error', status: 403, message: 'Forbidden' })
    })

    it('should warn and skip when hook invocation errors', async () => {
      // Arrange
      const access1 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const access2 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker, logger } = setupExecutor(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === access1.id) {
          return errorResult('API timeout')
        }

        return successResult<AccessHookResult>({ executed: true, outcome: 'continue' })
      })

      // Act
      const result = await executor.executeAccessHooks(step, invoker, context)

      // Assert
      expect(logger.warn).toHaveBeenCalledWith('Access hook error: API timeout')
      expect(invoker.invoke).toHaveBeenCalledWith(access2.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should skip non-executed hooks (when condition false)', async () => {
      // Arrange
      const access1 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const access2 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStep({ onAccess: [access1, access2] })
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === access1.id) {
          return successResult<AccessHookResult>({ executed: false, outcome: 'continue' })
        }

        return successResult<AccessHookResult>({ executed: true, outcome: 'continue' })
      })

      // Act
      const result = await executor.executeAccessHooks(step, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledWith(access2.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should work with journey ancestors', async () => {
      // Arrange
      const access = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const journey = createJourney({ onAccess: [access] })
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)

      invoker.invoke.mockResolvedValue(successResult<AccessHookResult>({ executed: true, outcome: 'continue' }))

      // Act
      const result = await executor.executeAccessHooks(journey, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledWith(access.id, context)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })
  })

  describe('executeActionHooks()', () => {
    it('should return not-executed when step has no action hooks', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      // Act
      const result = await executor.executeActionHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false })
    })

    it('should return first executed action (first-match semantics)', async () => {
      // Arrange
      const action1 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
      const action2 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
      const step = createStep({ onAction: [action1, action2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === action1.id) {
          return successResult<ActionHookResult>({ executed: true })
        }

        return successResult<ActionHookResult>({ executed: false })
      })

      // Act
      const result = await executor.executeActionHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true })
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
      expect(invoker.invoke).not.toHaveBeenCalledWith(action2.id, expect.anything())
    })

    it('should skip non-matching actions and return not-executed', async () => {
      // Arrange
      const action1 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
      const action2 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
      const step = createStep({ onAction: [action1, action2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockResolvedValue(successResult<ActionHookResult>({ executed: false }))

      // Act
      const result = await executor.executeActionHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should skip action hooks that error', async () => {
      // Arrange
      const action1 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
      const action2 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
      const step = createStep({ onAction: [action1, action2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === action1.id) {
          return errorResult('Failed to evaluate')
        }

        return successResult<ActionHookResult>({ executed: true })
      })

      // Act
      const result = await executor.executeActionHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('executeSubmitHooks()', () => {
    it('should return default when step has no submit hooks', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      // Act
      const result = await executor.executeSubmitHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false, validated: false, outcome: 'continue' })
    })

    it('should return first executed submit (first-match semantics)', async () => {
      // Arrange
      const submit1 = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const submit2 = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const step = createStep({ onSubmission: [submit1, submit2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      const submitResult: SubmitHookResult = {
        executed: true,
        validated: true,
        isValid: false,
        outcome: 'continue',
      }

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === submit1.id) {
          return successResult(submitResult)
        }

        return successResult<SubmitHookResult>({ executed: false, validated: false, outcome: 'continue' })
      })

      // Act
      const result = await executor.executeSubmitHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual(submitResult)
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
      expect(invoker.invoke).not.toHaveBeenCalledWith(submit2.id, expect.anything())
    })

    it('should return redirect result from submit hook', async () => {
      // Arrange
      const submit = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const step = createStep({ onSubmission: [submit] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      const submitResult: SubmitHookResult = {
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: 'next-step',
      }

      invoker.invoke.mockResolvedValue(successResult(submitResult))

      // Act
      const result = await executor.executeSubmitHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual(submitResult)
    })

    it('should skip non-matching submit hooks and return default', async () => {
      // Arrange
      const submit1 = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const submit2 = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const step = createStep({ onSubmission: [submit1, submit2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockResolvedValue(
        successResult<SubmitHookResult>({ executed: false, validated: false, outcome: 'continue' }),
      )

      // Act
      const result = await executor.executeSubmitHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: false, validated: false, outcome: 'continue' })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })

    it('should skip submit hooks that error', async () => {
      // Arrange
      const submit1 = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const submit2 = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const step = createStep({ onSubmission: [submit1, submit2] })
      const { executor, context, invoker } = setupExecutor(step)
      const runtimePlan = createRuntimePlan(step)

      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        if (nodeId === submit1.id) {
          return errorResult('Validation service down')
        }

        return successResult<SubmitHookResult>({
          executed: true,
          validated: false,
          outcome: 'redirect',
          redirect: 'next',
        })
      })

      // Act
      const result = await executor.executeSubmitHooks(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, validated: false, outcome: 'redirect', redirect: 'next' })
      expect(invoker.invoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('executeAccessLifecycle()', () => {
    function setupLifecycle(ancestors: (JourneyASTNode | StepASTNode)[]): {
      executor: HookExecutor
      context: Mocked<ThunkEvaluationContext>
      invoker: Mocked<ThunkInvocationAdapter>
      runtimePlan: StepRuntimePlan
    } {
      const accessAncestorIds = ancestors.map(a => a.id) as AstNodeId[]

      const context = {
        metadataRegistry: {
          get: vi.fn().mockImplementation((nodeId: NodeId, key: string) => {
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
          get: vi.fn().mockImplementation((nodeId: NodeId) => {
            return ancestors.find(a => a.id === nodeId)
          }),
        },
        global: {
          answers: {},
          data: {},
        },
      } as unknown as Mocked<ThunkEvaluationContext>

      const invoker = {
        invoke: vi.fn(),
        invokeSync: vi.fn(),
      } as Mocked<ThunkInvocationAdapter>

      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const executor = new HookExecutor(logger as unknown as Console)
      const runtimePlan = createRuntimePlan(ancestors.at(-1)! as StepASTNode, {
        accessAncestorIds,
      })

      return { executor, context, invoker, runtimePlan }
    }

    it('should return continue when no ancestors have hooks', async () => {
      // Arrange
      const step = createStep({})
      const { executor, context, invoker, runtimePlan } = setupLifecycle([step])

      // Act
      const result = await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'continue' })
      expect(invoker.invoke).not.toHaveBeenCalled()
    })

    it('should run access hooks for all ancestors in outer-to-inner order', async () => {
      // Arrange
      const journeyAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const stepAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode

      const journey = createJourney({ onAccess: [journeyAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([journey, step])

      const invocationOrder: string[] = []
      invoker.invoke.mockImplementation(async (nodeId: NodeId) => {
        invocationOrder.push(nodeId)

        return successResult<AccessHookResult>({ executed: true, outcome: 'continue' })
      })

      // Act
      await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(invocationOrder.indexOf(journeyAccess.id)).toBeLessThan(invocationOrder.indexOf(stepAccess.id))
    })

    it('should halt on redirect and not run subsequent ancestors', async () => {
      // Arrange
      const journeyAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const stepAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode

      const journey = createJourney({ onAccess: [journeyAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([journey, step])

      invoker.invoke.mockResolvedValue(
        successResult<AccessHookResult>({ executed: true, outcome: 'redirect', redirect: '/login' }),
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
      const journeyAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const stepAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode

      const journey = createJourney({ onAccess: [journeyAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([journey, step])

      invoker.invoke.mockResolvedValue(
        successResult<AccessHookResult>({ executed: true, outcome: 'error', status: 403 }),
      )

      // Act
      const result = await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(result.outcome).toBe('error')
      expect(invoker.invoke).toHaveBeenCalledTimes(1)
    })

    it('should run hooks across deeply nested hierarchy', async () => {
      // Arrange
      const outerAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const innerAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const stepAccess = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode

      const outerJourney = createJourney({ onAccess: [outerAccess] })
      const innerJourney = createJourney({ onAccess: [innerAccess] })
      const step = createStep({ onAccess: [stepAccess] })
      const { executor, context, invoker, runtimePlan } = setupLifecycle([outerJourney, innerJourney, step])

      invoker.invoke.mockResolvedValue(successResult<AccessHookResult>({ executed: true, outcome: 'continue' }))

      // Act
      const result = await executor.executeAccessLifecycle(runtimePlan, invoker, context)

      // Assert
      expect(invoker.invoke).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })
  })
})

import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter, ThunkResult } from '../../compilation/thunks/types'
import { NodeId } from '../../types/engine.type'
import StepValidityAnalyzer, { StepValidityResult } from '../evaluation/StepValidityAnalyzer'
import NavigationAnalyzer from './NavigationAnalyzer'

function createEntry(options: {
  stepId: NodeId
  path: string
  isEntryPoint?: boolean
  forwardOutcomeIds?: NodeId[]
  hasValidation?: boolean
  cleardownFieldCodes?: ReachabilityStepEntry['cleardownFieldCodes']
}): ReachabilityStepEntry {
  return {
    stepId: options.stepId,
    path: options.path,
    isEntryPoint: options.isEntryPoint ?? false,
    forwardOutcomeIds: options.forwardOutcomeIds ?? [],
    hasValidation: options.hasValidation ?? false,
    cleardownFieldCodes: options.cleardownFieldCodes ?? [],
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
  }
}

function successResult<T>(value: T): ThunkResult<T> {
  return { value, metadata: { source: 'test', timestamp: Date.now() } }
}

describe('NavigationAnalyzer', () => {
  let evaluator: NavigationAnalyzer
  let context: jest.Mocked<ThunkEvaluationContext>
  let invoker: jest.Mocked<ThunkInvocationAdapter>
  let mockStepValidityAnalyzer: jest.Mocked<StepValidityAnalyzer>

  beforeEach(() => {
    evaluator = new NavigationAnalyzer()
    mockStepValidityAnalyzer = {
      execute: jest.fn().mockResolvedValue({
        isValid: true,
        fieldFailures: [],
        domainFailures: [],
      } satisfies StepValidityResult),
    } as unknown as jest.Mocked<StepValidityAnalyzer>

    context = {
      global: {
        answers: {},
        data: {},
      },
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
      },
      metadataRegistry: {},
    } as unknown as jest.Mocked<ThunkEvaluationContext>

    invoker = {
      invoke: jest.fn().mockResolvedValue(successResult(undefined)),
      invokeSync: jest.fn(),
    } as unknown as jest.Mocked<ThunkInvocationAdapter>
  })

  it('should seed reachability from all entry points', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:1', path: 'one', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:2', path: 'two', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:3', path: 'three' }),
      ],
    }

    // Act
    const result = await evaluator.evaluate(plan, 'compile_ast:3', invoker, context, mockStepValidityAnalyzer)

    // Assert
    expect(result.steps.filter(step => step.isReachable).map(step => step.path)).toEqual(['one', 'two'])
    expect(result.steps.filter(step => !step.isReachable).map(step => step.path)).toEqual(['three'])
  })

  it('should match internal redirects using canonical paths', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:4',
          path: 'one',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:5'],
        }),
        createEntry({ stepId: 'compile_ast:6', path: 'two' }),
      ],
    }

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:5') {
        return successResult('two?tab=current#focus')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(plan, 'compile_ast:6', invoker, context, mockStepValidityAnalyzer)

    // Assert
    expect(result.steps.find(step => step.path === 'two')?.isReachable).toBe(true)
  })

  it('should only evaluate validation for reachable steps', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:21',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:22'],
        }),
        createEntry({
          stepId: 'compile_ast:23',
          path: 'reachable',
          hasValidation: true,
        }),
        createEntry({
          stepId: 'compile_ast:24',
          path: 'unreachable',
          hasValidation: true,
        }),
      ],
    }

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:22') {
        return successResult('reachable')
      }

      return successResult(undefined)
    })

    // Act
    await evaluator.evaluate(plan, 'compile_ast:24', invoker, context, mockStepValidityAnalyzer)

    // Assert
    const checkedStepIds = mockStepValidityAnalyzer.execute.mock.calls.map(call => call[0].stepId)

    expect(checkedStepIds).toContain('compile_ast:23')
    expect(checkedStepIds).not.toContain('compile_ast:24')
  })

  it('should record predecessor paths for reachable steps', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:50',
          path: 'first',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:51'],
        }),
        createEntry({
          stepId: 'compile_ast:52',
          path: 'second',
          forwardOutcomeIds: ['compile_ast:53'],
        }),
        createEntry({ stepId: 'compile_ast:54', path: 'third' }),
      ],
    }

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:51') {
        return successResult('second')
      }

      if (nodeId === 'compile_ast:53') {
        return successResult('third')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(plan, 'compile_ast:54', invoker, context, mockStepValidityAnalyzer)

    // Assert
    expect(result.steps.find(step => step.path === 'first')?.predecessorPaths).toEqual([])
    expect(result.steps.find(step => step.path === 'second')?.predecessorPaths).toEqual(['first'])
    expect(result.steps.find(step => step.path === 'third')?.predecessorPaths).toEqual(['second'])
  })

  it('should record multiple predecessor paths for converging steps', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:55',
          path: 'branch-a',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:56'],
        }),
        createEntry({
          stepId: 'compile_ast:57',
          path: 'branch-b',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:58'],
        }),
        createEntry({ stepId: 'compile_ast:59', path: 'converge' }),
      ],
    }

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:56' || nodeId === 'compile_ast:58') {
        return successResult('converge')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(plan, 'compile_ast:59', invoker, context, mockStepValidityAnalyzer)

    // Assert
    expect(result.steps.find(step => step.path === 'converge')?.predecessorPaths).toEqual(['branch-a', 'branch-b'])
  })

  it('should stop once the target step is reachable without validating the target step itself', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:25',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:26'],
        }),
        createEntry({
          stepId: 'compile_ast:27',
          path: 'middle',
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:28'],
        }),
        createEntry({
          stepId: 'compile_ast:29',
          path: 'target',
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:30'],
        }),
        createEntry({
          stepId: 'compile_ast:31',
          path: 'after-target',
          hasValidation: true,
        }),
      ],
    }

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:26') {
        return successResult('middle')
      }

      if (nodeId === 'compile_ast:28') {
        return successResult('target')
      }

      if (nodeId === 'compile_ast:30') {
        return successResult('after-target')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(plan, 'compile_ast:29', invoker, context, mockStepValidityAnalyzer)

    // Assert
    expect(result.steps.find(step => step.path === 'target')?.isReachable).toBe(true)

    const checkedStepIds = mockStepValidityAnalyzer.execute.mock.calls.map(call => call[0].stepId)

    expect(checkedStepIds).toContain('compile_ast:27')
    expect(checkedStepIds).not.toContain('compile_ast:29')
    expect(checkedStepIds).not.toContain('compile_ast:31')
  })
})

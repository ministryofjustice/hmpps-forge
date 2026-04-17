import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter, ThunkResult } from '../../compilation/thunks/types'
import { joinPaths } from '../../../framework/path/routePath'
import { NodeId } from '../../types/engine.type'
import StepValidityAnalyzer, { StepValidityResult } from '../evaluation/StepValidityAnalyzer'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
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

function createRouteTemplateCatalog(entries: ReachabilityStepEntry[]): JourneyRouteTemplateCatalog {
  const routeTemplatePathByStepId = new Map<NodeId, string>()
  const stepIdByRouteTemplatePath = new Map<string, NodeId>()

  entries.forEach(entry => {
    const routeTemplatePath = joinPaths('/journey', entry.path)

    routeTemplatePathByStepId.set(entry.stepId, routeTemplatePath)
    stepIdByRouteTemplatePath.set(routeTemplatePath, entry.stepId)
  })

  return {
    routeTemplatePathByStepId,
    stepIdByRouteTemplatePath,
  }
}

describe('NavigationAnalyzer', () => {
  let evaluator: NavigationAnalyzer
  let context: Mocked<ThunkEvaluationContext>
  let invoker: Mocked<ThunkInvocationAdapter>
  let mockStepValidityAnalyzer: Mocked<StepValidityAnalyzer>

  beforeEach(() => {
    evaluator = new NavigationAnalyzer()
    mockStepValidityAnalyzer = {
      execute: vi.fn().mockResolvedValue({
        isValid: true,
        fieldFailures: [],
        domainFailures: [],
      } satisfies StepValidityResult),
    } as unknown as Mocked<StepValidityAnalyzer>

    context = {
      global: {
        answers: {},
        data: {},
      },
      nodeRegistry: {
        findByType: vi.fn().mockReturnValue([]),
      },
      metadataRegistry: {},
    } as unknown as Mocked<ThunkEvaluationContext>

    invoker = {
      invoke: vi.fn().mockResolvedValue(successResult(undefined)),
      invokeSync: vi.fn(),
    } as unknown as Mocked<ThunkInvocationAdapter>
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
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:3',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)).toEqual([
      '/journey/one',
      '/journey/two',
    ])
    expect(result.steps.filter(step => !step.isReachable).map(step => step.routeTemplatePath)).toEqual([
      '/journey/three',
    ])
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
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:5') {
        return successResult('two?tab=current#focus')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:6',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/two')?.isReachable).toBe(true)
  })

  it('should resolve relative ancestor redirects using route template paths', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:10',
          path: 'people/:personId/details',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:11'],
        }),
        createEntry({
          stepId: 'compile_ast:12',
          path: 'people/list',
        }),
      ],
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:11') {
        return successResult('../../people/list?from=details#errors')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:12',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/people/list')?.isReachable).toBe(true)
  })

  it('should exclude external and unknown absolute redirects from the reachability graph', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:13',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:14', 'compile_ast:15'],
        }),
        createEntry({
          stepId: 'compile_ast:16',
          path: 'known',
        }),
      ],
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:14') {
        return successResult('https://service.test/logout')
      }

      if (nodeId === 'compile_ast:15') {
        return successResult('/help/contact')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:16',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/entry')?.forwardRouteTemplatePaths).toEqual(
      [],
    )
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/known')?.isReachable).toBe(false)
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
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:22') {
        return successResult('reachable')
      }

      return successResult(undefined)
    })

    // Act
    await evaluator.evaluate(plan, 'compile_ast:24', routeTemplateCatalog, invoker, context, mockStepValidityAnalyzer)

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
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

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
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:54',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/first')?.predecessorRouteTemplatePaths,
    ).toEqual([])
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/second')?.predecessorRouteTemplatePaths,
    ).toEqual(['/journey/first'])
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/third')?.predecessorRouteTemplatePaths,
    ).toEqual(['/journey/second'])
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
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:56' || nodeId === 'compile_ast:58') {
        return successResult('converge')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:59',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/converge')?.predecessorRouteTemplatePaths,
    ).toEqual(['/journey/branch-a', '/journey/branch-b'])
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
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

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
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:29',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/target')?.isReachable).toBe(true)

    const checkedStepIds = mockStepValidityAnalyzer.execute.mock.calls.map(call => call[0].stepId)

    expect(checkedStepIds).toContain('compile_ast:27')
    expect(checkedStepIds).not.toContain('compile_ast:29')
    expect(checkedStepIds).not.toContain('compile_ast:31')
  })
})

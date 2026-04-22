import { joinPaths } from '../../../framework/path/routePath'
import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter, ThunkResult } from '../../compilation/thunks/types'
import { NodeId } from '../../types/engine.type'
import StepValidityAnalyzer, { StepValidityResult } from '../validation/StepValidityAnalyzer'
import { JourneyRouteTemplateCatalog } from '../routes/routes.type'
import NavigationAnalyzer from './NavigationAnalyzer'

function createEntry(options: {
  stepId: NodeId
  path: string
  isEntryPoint?: boolean
  entryWhenNodeId?: NodeId
  forwardOutcomeIds?: NodeId[]
  hasValidation?: boolean
  reachabilityTieBreakers?: ReachabilityStepEntry['reachabilityTieBreakers']
}): ReachabilityStepEntry {
  return {
    stepId: options.stepId,
    path: options.path,
    isEntryPoint: options.isEntryPoint ?? false,
    entryWhenNodeId: options.entryWhenNodeId,
    forwardOutcomeIds: options.forwardOutcomeIds ?? [],
    hasValidation: options.hasValidation ?? false,
    cleardownFieldCodes: [],
    iterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    reachabilityTieBreakers: options.reachabilityTieBreakers ?? [],
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

  function mockValidityByStepId(validStepIds: NodeId[]): void {
    mockStepValidityAnalyzer.execute.mockImplementation(async runtimePlan => ({
      isValid: validStepIds.includes(runtimePlan.stepId),
      fieldFailures: [],
      domainFailures: [],
    }))
  }

  it('should seed unconditional and conditional entry points without inventing a fallback reachable step', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:1', path: 'start', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:2', path: 'gated', entryWhenNodeId: 'compile_ast:99' }),
        createEntry({ stepId: 'compile_ast:3', path: 'later' }),
      ],
      resumeAlways: false,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:99') {
        return successResult(true)
      }

      return successResult(undefined)
    })

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
      '/journey/start',
      '/journey/gated',
    ])
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/start')
  })

  it('should resolve internal redirect outcomes using canonical route template paths', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:4',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:5'],
        }),
        createEntry({
          stepId: 'compile_ast:6',
          path: 'next',
        }),
      ],
      resumeAlways: false,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:5') {
        return successResult('next?tab=current#focus')
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
    expect(result.steps.find(step => step.stepId === 'compile_ast:6')?.isReachable).toBe(true)
  })

  it('should ignore trivially valid reachable steps when computing progress', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:10',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:11'],
        }),
        createEntry({
          stepId: 'compile_ast:12',
          path: 'question',
          hasValidation: true,
        }),
      ],
      resumeAlways: true,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    mockValidityByStepId([])
    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:11') {
        return successResult('question')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:10',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.progressExists).toBe(false)
    expect(result.resumeOutcome).toBe('no-op')
    expect(result.frontierRouteTemplatePath).toBe('/journey/question')
  })

  it('should count a valid reachable entry with validation requirements as progress', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:20',
          path: 'entry',
          isEntryPoint: true,
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:21'],
        }),
        createEntry({
          stepId: 'compile_ast:22',
          path: 'next',
          hasValidation: true,
        }),
      ],
      resumeAlways: true,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    mockValidityByStepId(['compile_ast:20'])
    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:21') {
        return successResult('next')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:20',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.progressExists).toBe(true)
    expect(result.frontierRouteTemplatePath).toBe('/journey/next')
    expect(result.resumeOutcome).toBe('redirect')
  })

  it('should redirect resume requests to the first invalid non-entry step on the progress path', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:30',
          path: 'your-name',
          isEntryPoint: true,
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:31'],
        }),
        createEntry({
          stepId: 'compile_ast:32',
          path: 'your-role',
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:33'],
        }),
        createEntry({
          stepId: 'compile_ast:34',
          path: 'check-answers',
          hasValidation: true,
        }),
      ],
      resumeAlways: true,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    mockValidityByStepId(['compile_ast:30'])
    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:31') {
        return successResult('your-role')
      }

      if (nodeId === 'compile_ast:33') {
        return successResult('check-answers')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:30',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.canonicalPathRouteTemplatePaths).toEqual(['/journey/your-name', '/journey/your-role'])
    expect(result.frontierRouteTemplatePath).toBe('/journey/your-role')
    expect(result.resumeOutcome).toBe('redirect')
  })

  it('should not redirect when the current step is already the frontier', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:40',
          path: 'your-name',
          isEntryPoint: true,
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:41'],
        }),
        createEntry({
          stepId: 'compile_ast:42',
          path: 'your-role',
          hasValidation: true,
        }),
      ],
      resumeAlways: true,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    mockValidityByStepId(['compile_ast:40'])
    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:41') {
        return successResult('your-role')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:42',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.frontierRouteTemplatePath).toBe('/journey/your-role')
    expect(result.resumeOutcome).toBe('no-op')
  })

  it('should fall back to the winning entry when resume is active but the journey is complete', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:50',
          path: 'overview',
          isEntryPoint: true,
        }),
        createEntry({
          stepId: 'compile_ast:51',
          path: 'your-name',
          isEntryPoint: true,
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:52'],
          reachabilityTieBreakers: [{ priority: 100 }],
        }),
        createEntry({
          stepId: 'compile_ast:53',
          path: 'confirmation',
          hasValidation: true,
        }),
      ],
      resumeAlways: true,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    mockValidityByStepId(['compile_ast:51', 'compile_ast:53'])
    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:52') {
        return successResult('confirmation')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/your-name')
    expect(result.frontierRouteTemplatePath).toBeUndefined()
    expect(result.resumeOutcome).toBe('no-op')
  })

  it('should prefer the entry path with the deepest real progress when resume is active', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:60',
          path: 'entry-low',
          isEntryPoint: true,
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:61'],
          reachabilityTieBreakers: [{ priority: 10 }],
        }),
        createEntry({
          stepId: 'compile_ast:62',
          path: 'entry-high',
          isEntryPoint: true,
          hasValidation: true,
          reachabilityTieBreakers: [{ priority: 50 }],
        }),
        createEntry({
          stepId: 'compile_ast:63',
          path: 'after-low',
          hasValidation: true,
        }),
      ],
      resumeAlways: true,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    mockValidityByStepId(['compile_ast:60', 'compile_ast:62', 'compile_ast:63'])
    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:61') {
        return successResult('after-low')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.canonicalPathRouteTemplatePaths).toEqual(['/journey/entry-low', '/journey/after-low'])
    expect(result.frontierRouteTemplatePath).toBeUndefined()
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/entry-high')
  })

  it('should derive a canonical current-step path using predecessor tie-breakers for converging branches', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:70',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:71', 'compile_ast:72'],
        }),
        createEntry({
          stepId: 'compile_ast:73',
          path: 'branch-a',
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:74'],
          reachabilityTieBreakers: [{ priority: 10 }],
        }),
        createEntry({
          stepId: 'compile_ast:75',
          path: 'branch-b',
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:76'],
          reachabilityTieBreakers: [{ priority: 100 }],
        }),
        createEntry({
          stepId: 'compile_ast:77',
          path: 'merge',
          hasValidation: true,
        }),
      ],
      resumeAlways: false,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    mockValidityByStepId(['compile_ast:73', 'compile_ast:75', 'compile_ast:77'])
    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:71') {
        return successResult('branch-a')
      }

      if (nodeId === 'compile_ast:72') {
        return successResult('branch-b')
      }

      if (nodeId === 'compile_ast:74' || nodeId === 'compile_ast:76') {
        return successResult('merge')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:77',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.canonicalPathRouteTemplatePaths).toEqual(['/journey/entry', '/journey/branch-b', '/journey/merge'])
  })

  it('should fall back to the first declared step when no active entry point exists', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:80', path: 'first' }),
        createEntry({ stepId: 'compile_ast:81', path: 'second' }),
      ],
      resumeAlways: false,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:81',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/first')
    expect(result.steps.every(step => !step.isReachable)).toBe(true)
  })

  it('should mark all steps reachable and skip the BFS walk when reachabilityDisabled is true', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:90', path: 'page-one' }),
        createEntry({ stepId: 'compile_ast:91', path: 'page-two' }),
        createEntry({ stepId: 'compile_ast:92', path: 'page-three' }),
      ],
      resumeAlways: false,
      reachabilityDisabled: true,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:91',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.every(step => step.isReachable)).toBe(true)
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/page-one')
    expect(result.resumeOutcome).toBe('no-op')
    expect(invoker.invoke).not.toHaveBeenCalled()
  })
})

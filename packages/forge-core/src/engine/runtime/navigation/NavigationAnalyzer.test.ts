import { joinPaths } from '../../../framework/path/routePath'
import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import { CompiledReachabilityResult } from '../../compilation/codegen/phase-compilers/reachability/ReachabilityCompiler'
import { CompiledValidationFunction } from '../../compilation/codegen/phase-compilers/validation/StepValidationCompiler'
import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { NodeId } from '../../types/engine.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
import NavigationAnalyzer, { resolveJourneyRootRedirect, resolveStepRequestRedirect } from './NavigationAnalyzer'
import { pickTieBreakerWinner, resolveBacklinkRouteTemplatePathForStep } from './NavigationPathAnalyzer'
import { NavigationStepState } from '../types/NavigationEvaluation.type'

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

function createCompiledResult(
  plan: ReachabilityRuntimePlan,
  overrides: {
    entryResults?: Record<number, boolean>
    outcomeValues?: Record<number, string[]>
    tieBreakerPriorities?: Record<number, number>
    resumeActive?: boolean
  } = {},
): CompiledReachabilityResult {
  const count = plan.entries.length

  return {
    entryResults: Array.from({ length: count }, (_, i) => overrides.entryResults?.[i]),
    outcomeValues: Array.from({ length: count }, (_, i) => overrides.outcomeValues?.[i] ?? []),
    tieBreakerPriorities: Array.from({ length: count }, (_, i) => overrides.tieBreakerPriorities?.[i]),
    resumeActive: overrides.resumeActive ?? false,
  }
}

function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
  return {
    stepId: 'compile_ast:500',
    routeTemplatePath: '/journey/current',
    declarationIndex: 0,
    isEntryPoint: false,
    isConditionalEntry: false,
    hasValidation: false,
    isReachable: true,
    isValid: true,
    forwardRouteTemplatePaths: [],
    predecessorRouteTemplatePaths: [],
    ...overrides,
  }
}

describe('NavigationAnalyzer', () => {
  let analyzer: NavigationAnalyzer
  let context: Mocked<RuntimeEvaluationContext>
  let mockFunctionRegistry: FunctionRegistry

  beforeEach(() => {
    analyzer = new NavigationAnalyzer()
    mockFunctionRegistry = {} as FunctionRegistry

    context = {
      global: {
        answers: {},
        data: {},
      },
      request: {
        url: 'http://localhost/forms/journey/',
        method: 'GET',
        location: {
          origin: 'http://localhost',
          pathname: '/forms/journey/',
          href: 'http://localhost/forms/journey/',
          basePath: '/forms/journey',
        },
        getParams: vi.fn().mockReturnValue({}),
        getSession: vi.fn().mockReturnValue(undefined),
        getAllQuery: vi.fn().mockReturnValue({}),
        getAllHeaders: vi.fn().mockReturnValue({}),
        getAllCookies: vi.fn().mockReturnValue({}),
        getAllState: vi.fn().mockReturnValue({}),
      },
      nodeRegistry: {
        findByType: vi.fn().mockReturnValue([]),
      },
    } as unknown as Mocked<RuntimeEvaluationContext>
  })

  function setStepValidities(plan: ReachabilityRuntimePlan, validStepIds: NodeId[]): void {
    const validations = new Map<NodeId, CompiledValidationFunction>()

    for (const entry of plan.entries) {
      if (!entry.hasValidation) {
        continue
      }

      const isValid = validStepIds.includes(entry.stepId)

      validations.set(entry.stepId, () => ({ isValid, fieldFailures: [], domainFailures: [] }))
    }

    plan.resolveStepValidations = () => validations
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
    const compiledResult = createCompiledResult(plan, { entryResults: { 1: true } })

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:3',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['next?tab=current#focus'] },
    })

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:6',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['question'] },
      resumeActive: true,
    })

    setStepValidities(plan, [])

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:10',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['next'] },
      resumeActive: true,
    })

    setStepValidities(plan, ['compile_ast:20'])

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:20',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['your-role'], 1: ['check-answers'] },
      resumeActive: true,
    })

    setStepValidities(plan, ['compile_ast:30'])

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:30',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['your-role'] },
      resumeActive: true,
    })

    setStepValidities(plan, ['compile_ast:40'])

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:42',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 1: ['confirmation'] },
      tieBreakerPriorities: { 1: 100 },
      resumeActive: true,
    })

    setStepValidities(plan, ['compile_ast:51', 'compile_ast:53'])

    // Act
    const result = await analyzer.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['after-low'] },
      tieBreakerPriorities: { 0: 10, 1: 50 },
      resumeActive: true,
    })

    setStepValidities(plan, ['compile_ast:60', 'compile_ast:62', 'compile_ast:63'])

    // Act
    const result = await analyzer.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['branch-a', 'branch-b'], 1: ['merge'], 2: ['merge'] },
      tieBreakerPriorities: { 1: 10, 2: 100 },
    })

    setStepValidities(plan, ['compile_ast:73', 'compile_ast:75', 'compile_ast:77'])

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:77',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan)

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:81',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
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
    const compiledResult = createCompiledResult(plan)

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:91',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
    )

    // Assert
    expect(result.steps.every(step => step.isReachable)).toBe(true)
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/page-one')
    expect(result.resumeOutcome).toBe('no-op')
  })

  it('should await async compiled validation during reachability graph walking', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:100',
          path: 'entry',
          isEntryPoint: true,
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:101'],
        }),
        createEntry({
          stepId: 'compile_ast:102',
          path: 'next',
        }),
      ],
      resumeAlways: true,
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['next'] },
      resumeActive: true,
    })
    const validationSpy: CompiledValidationFunction = vi.fn(async () => {
      await Promise.resolve()

      return { isValid: true, fieldFailures: [], domainFailures: [] }
    })

    plan.resolveStepValidations = () => new Map([[plan.entries[0].stepId, validationSpy]])

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:100',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
    )

    // Assert
    expect(validationSpy).toHaveBeenCalledTimes(1)
    expect(validationSpy).toHaveBeenCalledWith(expect.anything(), false, ['default'])
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/next')?.isReachable).toBe(true)
  })
})

describe('navigation policy helpers', () => {
  it('should resolve step redirects from resume and reachability state', () => {
    // Arrange
    const reachable = createNavigationStep()
    const unreachable = createNavigationStep({ isReachable: false })

    // Act / Assert
    expect(
      resolveStepRequestRedirect({
        currentStepId: reachable.stepId,
        steps: [reachable],
        defaultEntryRouteTemplatePath: '/journey/entry',
        frontierRouteTemplatePath: '/journey/frontier',
        canonicalPathRouteTemplatePaths: [],
        progressExists: true,
        resumeActive: true,
        resumeOutcome: 'redirect',
      }),
    ).toBe('/journey/frontier')

    expect(
      resolveStepRequestRedirect({
        currentStepId: unreachable.stepId,
        steps: [unreachable],
        defaultEntryRouteTemplatePath: '/journey/entry',
        frontierRouteTemplatePath: undefined,
        canonicalPathRouteTemplatePaths: [],
        progressExists: false,
        resumeActive: false,
        resumeOutcome: 'no-op',
      }),
    ).toBe('/journey/entry')
  })

  it('should resolve journey root redirects from resume and default entry state', () => {
    // Arrange
    const evaluation = {
      currentStepId: undefined,
      steps: [],
      defaultEntryRouteTemplatePath: '/journey/entry',
      frontierRouteTemplatePath: '/journey/frontier',
      canonicalPathRouteTemplatePaths: [],
      progressExists: true,
      resumeActive: true,
      resumeOutcome: 'redirect' as const,
    }

    // Act / Assert
    expect(resolveJourneyRootRedirect(evaluation)).toBe('/journey/frontier')
    expect(resolveJourneyRootRedirect({ ...evaluation, resumeOutcome: 'no-op' })).toBe('/journey/entry')
  })

  it('should resolve backlinks from the canonical path', () => {
    // Arrange
    const current = createNavigationStep({ routeTemplatePath: '/journey/converge' })

    // Act / Assert
    expect(
      resolveBacklinkRouteTemplatePathForStep(current, ['/journey/start', '/journey/branch-b', '/journey/converge']),
    ).toBe('/journey/branch-b')
    expect(resolveBacklinkRouteTemplatePathForStep(current, ['/journey/start'])).toBeUndefined()
  })

  it('should pick tie-breaker winners by priority then declaration order', () => {
    // Arrange
    const first = createNavigationStep({ stepId: 'compile_ast:510', tieBreakerPriority: 5 })
    const second = createNavigationStep({ stepId: 'compile_ast:511', tieBreakerPriority: 10 })
    const unmatched = createNavigationStep({ stepId: 'compile_ast:512' })

    // Act / Assert
    expect(pickTieBreakerWinner([first, second])).toBe(second)
    expect(pickTieBreakerWinner([first, { ...second, tieBreakerPriority: 5 }])).toBe(first)
    expect(pickTieBreakerWinner([unmatched, first])).toBe(first)
    expect(pickTieBreakerWinner([])).toBeUndefined()
  })
})

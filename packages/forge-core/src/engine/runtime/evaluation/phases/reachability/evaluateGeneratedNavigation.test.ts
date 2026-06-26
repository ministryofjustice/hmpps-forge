import { beforeEach, describe, expect, it, vi } from 'vitest'
import { joinPaths } from '../../../../../framework/path/routePath'
import type { NavigationRuntimePlan, NavigationRuntimeEntry } from '../../../../contracts/plans/runtimePlans.type'
import { CompiledReachabilityResult } from '../../../../contracts/compiled/compiledFunctions.type'
import type { CompiledNavigationContext } from '../../../../contracts/compiled/compiledContexts.type'
import type { StepValidityResult } from '../../../../contracts/runtime/stepValidityResult.type'
import { NodeId } from '../../../../contracts/ast/engine.type'
import { JourneyRouteTemplateCatalog } from '../../../../contracts/routing/routeTree.type'
import { pickTieBreakerWinner, resolveBacklinkRouteTemplatePathForStep } from './NavigationPathAnalyzer'
import { ReachabilityEvaluation, ReachabilityNode } from '../../../../contracts/navigation/reachabilityEvaluation.type'
import { REACHABILITY_EVALUATION_WORK_HANDLER } from './ReachabilityEvaluationWorkHandler'
import WorkContext from '../../work/WorkContext'
import WorkExecutor from '../../work/WorkExecutor'
import { createWorkTask } from '../../work/workTask'

const routePathsByStepId = new Map<NodeId, string>()
const validationStepIds = new Set<NodeId>()
let stepValidities = new Map<NodeId, StepValidityResult>()

function createEntry(options: {
  stepId: NodeId
  path: string
  isEntryPoint?: boolean
  entryWhenNodeId?: NodeId
  hasValidation?: boolean
  reachabilityTieBreakers?: Array<{ priority: number; whenNodeId?: NodeId }>
}): NavigationRuntimeEntry {
  routePathsByStepId.set(options.stepId, options.path)

  if (options.hasValidation) {
    validationStepIds.add(options.stepId)
  }

  return {
    stepId: options.stepId,
    isEntryPoint: options.isEntryPoint ?? false,
  }
}

function createRouteTemplateCatalog(entries: NavigationRuntimeEntry[]): JourneyRouteTemplateCatalog {
  const routeTemplatePathByStepId = new Map<NodeId, string>()
  const stepIdByRouteTemplatePath = new Map<string, NodeId>()

  entries.forEach(entry => {
    const routePath = routePathsByStepId.get(entry.stepId) ?? entry.stepId
    const routeTemplatePath = joinPaths('/journey', routePath)

    routeTemplatePathByStepId.set(entry.stepId, routeTemplatePath)
    stepIdByRouteTemplatePath.set(routeTemplatePath, entry.stepId)
  })

  return {
    routeTemplatePathByStepId,
    stepIdByRouteTemplatePath,
  }
}

function createCompiledResult(
  plan: NavigationRuntimePlan,
  overrides: {
    entryResults?: Record<number, boolean>
    outcomeValues?: Record<number, string[]>
    declaredOutcomeValues?: Record<number, string[]>
    tieBreakerPriorities?: Record<number, number>
    resumeActive?: boolean
  } = {},
): CompiledReachabilityResult {
  const count = plan.entries.length

  return {
    entryResults: Array.from({ length: count }, (_, i) => overrides.entryResults?.[i]),
    outcomeValues: Array.from({ length: count }, (_, i) => overrides.outcomeValues?.[i] ?? []),
    declaredOutcomeValues: Array.from(
      { length: count },
      (_, i) => overrides.declaredOutcomeValues?.[i] ?? overrides.outcomeValues?.[i] ?? [],
    ),
    tieBreakerPriorities: Array.from({ length: count }, (_, i) => overrides.tieBreakerPriorities?.[i]),
    resumeActive: overrides.resumeActive ?? false,
  }
}

function createNavigationStep(overrides: Partial<ReachabilityNode> = {}): ReachabilityNode {
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

describe('evaluateGeneratedNavigation', () => {
  let analyzer: {
    evaluate: (
      plan: NavigationRuntimePlan,
      currentStepId: NodeId | undefined,
      routeTemplateCatalog: JourneyRouteTemplateCatalog,
      context: unknown,
      compiledResult: CompiledReachabilityResult,
      functionRegistry: unknown,
    ) => Promise<ReachabilityEvaluation>
  }
  let validationContext: CompiledNavigationContext
  let context: unknown
  let mockFunctionRegistry: unknown

  beforeEach(() => {
    routePathsByStepId.clear()
    validationStepIds.clear()
    stepValidities = new Map()
    validationContext = {
      answers: {},
      data: {},
      session: {},
      params: {},
      query: {},
      request: {},
      conditions: {
        get: vi.fn(),
      },
      reachabilityEvaluationWorkHandler: REACHABILITY_EVALUATION_WORK_HANDLER,
    } as unknown as CompiledNavigationContext
    context = {}
    mockFunctionRegistry = {}
    analyzer = {
      evaluate: async (plan, currentStepId, routeTemplateCatalog, _context, compiledResult) => {
        const task = createWorkTask('navigation', REACHABILITY_EVALUATION_WORK_HANDLER, {
          input: { plan, currentStepId, routeTemplateCatalog, stepValidities },
          compiledResult,
        })
        const completed = await new WorkExecutor().execute(task, new WorkContext(validationContext))

        return completed.output.evaluation
      },
    }
  })

  function setStepValidities(plan: NavigationRuntimePlan, validStepIds: NodeId[]): void {
    stepValidities = new Map()

    plan.entries.forEach(entry => {
      if (!validationStepIds.has(entry.stepId)) {
        return
      }

      // Validity is now derived from the stored failures: an invalid step carries a
      // default-group, non-submission failure that the reachability read counts.
      const fieldFailures = validStepIds.includes(entry.stepId)
        ? []
        : [
            {
              blockId: `${entry.stepId}-field` as NodeId,
              passed: false,
              message: 'Required',
              submissionOnly: false,
              groups: ['default'],
            },
          ]

      stepValidities.set(entry.stepId, { fieldFailures, domainFailures: [] })
    })
  }

  it('should seed unconditional and conditional entry points without inventing a fallback reachable step', async () => {
    // Arrange
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:1', path: 'start', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:2', path: 'gated', entryWhenNodeId: 'compile_ast:99' }),
        createEntry({ stepId: 'compile_ast:3', path: 'later' }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
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
    expect(result.unreachableRedirect).toBe('entry')
  })

  it('should resolve internal redirect outcomes using canonical route template paths', async () => {
    // Arrange
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:4',
          path: 'entry',
          isEntryPoint: true,
        }),
        createEntry({
          stepId: 'compile_ast:6',
          path: 'next',
        }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:10',
          path: 'entry',
          isEntryPoint: true,
        }),
        createEntry({
          stepId: 'compile_ast:12',
          path: 'question',
          hasValidation: true,
        }),
      ],
      resumeConfigured: true,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:20',
          path: 'entry',
          isEntryPoint: true,
          hasValidation: true,
        }),
        createEntry({
          stepId: 'compile_ast:22',
          path: 'next',
          hasValidation: true,
        }),
      ],
      resumeConfigured: true,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:30',
          path: 'your-name',
          isEntryPoint: true,
          hasValidation: true,
        }),
        createEntry({
          stepId: 'compile_ast:32',
          path: 'your-role',
          hasValidation: true,
        }),
        createEntry({
          stepId: 'compile_ast:34',
          path: 'check-answers',
          hasValidation: true,
        }),
      ],
      resumeConfigured: true,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:40',
          path: 'your-name',
          isEntryPoint: true,
          hasValidation: true,
        }),
        createEntry({
          stepId: 'compile_ast:42',
          path: 'your-role',
          hasValidation: true,
        }),
      ],
      resumeConfigured: true,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
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
          reachabilityTieBreakers: [{ priority: 100 }],
        }),
        createEntry({
          stepId: 'compile_ast:53',
          path: 'confirmation',
          hasValidation: true,
        }),
      ],
      resumeConfigured: true,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:60',
          path: 'entry-low',
          isEntryPoint: true,
          hasValidation: true,
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
      resumeConfigured: true,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:70',
          path: 'entry',
          isEntryPoint: true,
        }),
        createEntry({
          stepId: 'compile_ast:73',
          path: 'branch-a',
          hasValidation: true,
          reachabilityTieBreakers: [{ priority: 10 }],
        }),
        createEntry({
          stepId: 'compile_ast:75',
          path: 'branch-b',
          hasValidation: true,
          reachabilityTieBreakers: [{ priority: 100 }],
        }),
        createEntry({
          stepId: 'compile_ast:77',
          path: 'merge',
          hasValidation: true,
        }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
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
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:80', path: 'first' }),
        createEntry({ stepId: 'compile_ast:81', path: 'second' }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
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

  it('should propagate reachability through every cascade-resolved forward edge when multiple submit hooks contribute', async () => {
    // Arrange
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:85',
          path: 'entry',
          isEntryPoint: true,
        }),
        createEntry({ stepId: 'compile_ast:88', path: 'add' }),
        createEntry({ stepId: 'compile_ast:89', path: 'check' }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['add', 'check'] },
    })

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:89',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
    )

    // Assert
    expect(result.steps.find(step => step.stepId === 'compile_ast:88')?.isReachable).toBe(true)
    expect(result.steps.find(step => step.stepId === 'compile_ast:89')?.isReachable).toBe(true)
  })

  it('should keep predecessor edges visible for unreachable steps when the cascade narrows outcomeValues', async () => {
    // Arrange
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:95',
          path: 'entry',
          isEntryPoint: true,
        }),
        createEntry({ stepId: 'compile_ast:96', path: 'add' }),
        createEntry({ stepId: 'compile_ast:97', path: 'check' }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['add'] },
      declaredOutcomeValues: { 0: ['add', 'check'] },
    })

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:96',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
    )

    // Assert
    expect(result.steps.find(step => step.stepId === 'compile_ast:96')?.isReachable).toBe(true)
    expect(result.steps.find(step => step.stepId === 'compile_ast:97')?.isReachable).toBe(false)
    expect(result.steps.find(step => step.stepId === 'compile_ast:95')?.declaredForwardRouteTemplatePaths).toEqual([
      '/journey/add',
      '/journey/check',
    ])
  })

  it('should mark all steps reachable and skip the BFS walk when reachabilityDisabled is true', async () => {
    // Arrange
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:90', path: 'page-one' }),
        createEntry({ stepId: 'compile_ast:91', path: 'page-two' }),
        createEntry({ stepId: 'compile_ast:92', path: 'page-three' }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
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

  it('should not propagate reachability past an invalid step', async () => {
    // Arrange
    const plan: NavigationRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:110', path: 'entry', isEntryPoint: true, hasValidation: true }),
        createEntry({ stepId: 'compile_ast:111', path: 'middle', hasValidation: true }),
        createEntry({ stepId: 'compile_ast:112', path: 'end' }),
      ],
      resumeConfigured: false,
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const compiledResult = createCompiledResult(plan, {
      outcomeValues: { 0: ['middle'], 1: ['end'] },
    })

    setStepValidities(plan, ['compile_ast:110'])

    // Act
    const result = await analyzer.evaluate(
      plan,
      'compile_ast:112',
      routeTemplateCatalog,
      context,
      compiledResult,
      mockFunctionRegistry,
    )

    // Assert — the valid entry reaches 'middle', but invalid 'middle' must not reach 'end'
    expect(result.steps.find(step => step.stepId === 'compile_ast:111')?.isReachable).toBe(true)
    expect(result.steps.find(step => step.stepId === 'compile_ast:111')?.isValid).toBe(false)
    expect(result.steps.find(step => step.stepId === 'compile_ast:112')?.isReachable).toBe(false)
    expect(result.steps.find(step => step.stepId === 'compile_ast:112')?.predecessorRouteTemplatePaths).toEqual([
      '/journey/middle',
    ])
  })
})

describe('NavigationPathAnalyzer helpers', () => {
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

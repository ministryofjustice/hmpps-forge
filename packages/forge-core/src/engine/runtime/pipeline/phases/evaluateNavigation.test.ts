import { evaluateNavigation } from './evaluateNavigation'
import TraceRecorder from '../trace/TraceRecorder'
import {
  createCompiledNavigationStep,
  createNavigationPlan,
  createNavigationValidationPlan,
  createRouteTemplateCatalog,
} from '../testing-helpers/navigationTestFixtures'
import type { NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { CompiledFieldValidationFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { ReachabilityContext } from '../../../contracts/compiled/phaseContexts.type'
import { NodeId } from '../../../contracts/ast/engine.type'
import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'

const mockCtx = {
  answers: {},
  data: {},
  session: {},
  params: {},
  query: {},
  request: {},
  conditions: {
    get: vi.fn(),
  },
} as unknown as ReachabilityContext

async function evaluate(
  plan: NavigationRuntimePlan,
  currentStepNodeId: NodeId | undefined,
): Promise<NavigationEvaluation> {
  const routeTemplateCatalog = createRouteTemplateCatalog(plan.navigationSteps)
  const result = await evaluateNavigation(plan, mockCtx, {
    currentStepNodeId,
    routeTemplateCatalog,
    redirectRule: 'step-post',
  })

  return result.evaluation
}

describe('evaluateNavigation', () => {
  it('should seed unconditional and conditional entry points without inventing a fallback reachable step', async () => {
    // Arrange
    const plan = createNavigationPlan([
      createCompiledNavigationStep({ nodeId: 'compile_ast:1', path: 'start', isEntryPoint: true }),
      createCompiledNavigationStep({
        nodeId: 'compile_ast:2',
        path: 'gated',
        evaluateEntryWhen: vi.fn().mockReturnValue(true),
      }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:3', path: 'later' }),
    ])

    // Act
    const result = await evaluate(plan, 'compile_ast:3')

    // Assert
    expect(result.steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)).toEqual([
      '/journey/start',
      '/journey/gated',
    ])
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/start')
    expect(result.unreachableRedirect).toBe('entry')
  })

  it('should exclude steps whose conditional entry predicate evaluates false', async () => {
    // Arrange
    const plan = createNavigationPlan([
      createCompiledNavigationStep({ nodeId: 'compile_ast:1', path: 'start', isEntryPoint: true }),
      createCompiledNavigationStep({
        nodeId: 'compile_ast:2',
        path: 'gated',
        evaluateEntryWhen: vi.fn().mockReturnValue(false),
      }),
    ])

    // Act
    const result = await evaluate(plan, 'compile_ast:1')

    // Assert
    expect(result.steps.find(step => step.stepNodeId === 'compile_ast:2')?.isReachable).toBe(false)
  })

  it('should resolve internal redirect outcomes using canonical route template paths', async () => {
    // Arrange
    const plan = createNavigationPlan([
      createCompiledNavigationStep({
        nodeId: 'compile_ast:4',
        path: 'entry',
        isEntryPoint: true,
        evaluateOutcomes: vi.fn().mockReturnValue(['next?tab=current#focus']),
      }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:6', path: 'next' }),
    ])

    // Act
    const result = await evaluate(plan, 'compile_ast:6')

    // Assert
    expect(result.steps.find(step => step.stepNodeId === 'compile_ast:6')?.isReachable).toBe(true)
  })

  it('should ignore trivially valid reachable steps when computing progress', async () => {
    // Arrange
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({
          nodeId: 'compile_ast:10',
          path: 'entry',
          isEntryPoint: true,
          evaluateOutcomes: vi.fn().mockReturnValue(['question']),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:12',
          path: 'question',
          validationPlan: createNavigationValidationPlan(false),
        }),
      ],
      { resumeConfigured: true, resumeAlways: true },
    )

    // Act
    const result = await evaluate(plan, 'compile_ast:10')

    // Assert
    expect(result.progressExists).toBe(false)
    expect(result.resumeOutcome).toBe('no-op')
    expect(result.frontierRouteTemplatePath).toBe('/journey/question')
  })

  it('should count a valid reachable entry with validation requirements as progress', async () => {
    // Arrange
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({
          nodeId: 'compile_ast:20',
          path: 'entry',
          isEntryPoint: true,
          validationPlan: createNavigationValidationPlan(true),
          evaluateOutcomes: vi.fn().mockReturnValue(['next']),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:22',
          path: 'next',
          validationPlan: createNavigationValidationPlan(false),
        }),
      ],
      { resumeConfigured: true, resumeAlways: true },
    )

    // Act
    const result = await evaluate(plan, 'compile_ast:20')

    // Assert
    expect(result.progressExists).toBe(true)
    expect(result.frontierRouteTemplatePath).toBe('/journey/next')
    expect(result.resumeOutcome).toBe('redirect')
  })

  it('should redirect resume requests to the first invalid non-entry step on the progress path', async () => {
    // Arrange
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({
          nodeId: 'compile_ast:30',
          path: 'your-name',
          isEntryPoint: true,
          validationPlan: createNavigationValidationPlan(true),
          evaluateOutcomes: vi.fn().mockReturnValue(['your-role']),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:32',
          path: 'your-role',
          validationPlan: createNavigationValidationPlan(false),
          evaluateOutcomes: vi.fn().mockReturnValue(['check-answers']),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:34',
          path: 'check-answers',
          validationPlan: createNavigationValidationPlan(false),
        }),
      ],
      { resumeConfigured: true, resumeAlways: true },
    )

    // Act
    const result = await evaluate(plan, 'compile_ast:30')

    // Assert
    expect(result.canonicalPathRouteTemplatePaths).toEqual(['/journey/your-name', '/journey/your-role'])
    expect(result.frontierRouteTemplatePath).toBe('/journey/your-role')
    expect(result.resumeOutcome).toBe('redirect')
  })

  it('should not redirect when the current step is already the frontier', async () => {
    // Arrange
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({
          nodeId: 'compile_ast:40',
          path: 'your-name',
          isEntryPoint: true,
          validationPlan: createNavigationValidationPlan(true),
          evaluateOutcomes: vi.fn().mockReturnValue(['your-role']),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:42',
          path: 'your-role',
          validationPlan: createNavigationValidationPlan(false),
        }),
      ],
      { resumeConfigured: true, resumeAlways: true },
    )

    // Act
    const result = await evaluate(plan, 'compile_ast:42')

    // Assert
    expect(result.frontierRouteTemplatePath).toBe('/journey/your-role')
    expect(result.resumeOutcome).toBe('no-op')
  })

  it('should fall back to the winning entry when resume is active but the journey is complete', async () => {
    // Arrange
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({ nodeId: 'compile_ast:50', path: 'overview', isEntryPoint: true }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:51',
          path: 'your-name',
          isEntryPoint: true,
          validationPlan: createNavigationValidationPlan(true),
          evaluateOutcomes: vi.fn().mockReturnValue(['confirmation']),
          evaluateTieBreaker: vi.fn().mockReturnValue(100),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:53',
          path: 'confirmation',
          validationPlan: createNavigationValidationPlan(true),
        }),
      ],
      { resumeConfigured: true, resumeAlways: true },
    )

    // Act
    const result = await evaluate(plan, undefined)

    // Assert
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/your-name')
    expect(result.frontierRouteTemplatePath).toBeUndefined()
    expect(result.resumeOutcome).toBe('no-op')
  })

  it('should prefer the entry path with the deepest real progress when resume is active', async () => {
    // Arrange
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({
          nodeId: 'compile_ast:60',
          path: 'entry-low',
          isEntryPoint: true,
          validationPlan: createNavigationValidationPlan(true),
          evaluateOutcomes: vi.fn().mockReturnValue(['after-low']),
          evaluateTieBreaker: vi.fn().mockReturnValue(10),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:62',
          path: 'entry-high',
          isEntryPoint: true,
          validationPlan: createNavigationValidationPlan(true),
          evaluateTieBreaker: vi.fn().mockReturnValue(50),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:63',
          path: 'after-low',
          validationPlan: createNavigationValidationPlan(true),
        }),
      ],
      { resumeConfigured: true, resumeAlways: true },
    )

    // Act
    const result = await evaluate(plan, undefined)

    // Assert
    expect(result.canonicalPathRouteTemplatePaths).toEqual(['/journey/entry-low', '/journey/after-low'])
    expect(result.frontierRouteTemplatePath).toBeUndefined()
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/entry-high')
  })

  it('should derive a canonical current-step path using predecessor tie-breakers for converging branches', async () => {
    // Arrange
    const plan = createNavigationPlan([
      createCompiledNavigationStep({
        nodeId: 'compile_ast:70',
        path: 'entry',
        isEntryPoint: true,
        evaluateOutcomes: vi.fn().mockReturnValue(['branch-a', 'branch-b']),
      }),
      createCompiledNavigationStep({
        nodeId: 'compile_ast:73',
        path: 'branch-a',
        validationPlan: createNavigationValidationPlan(true),
        evaluateOutcomes: vi.fn().mockReturnValue(['merge']),
        evaluateTieBreaker: vi.fn().mockReturnValue(10),
      }),
      createCompiledNavigationStep({
        nodeId: 'compile_ast:75',
        path: 'branch-b',
        validationPlan: createNavigationValidationPlan(true),
        evaluateOutcomes: vi.fn().mockReturnValue(['merge']),
        evaluateTieBreaker: vi.fn().mockReturnValue(100),
      }),
      createCompiledNavigationStep({
        nodeId: 'compile_ast:77',
        path: 'merge',
        validationPlan: createNavigationValidationPlan(true),
      }),
    ])

    // Act
    const result = await evaluate(plan, 'compile_ast:77')

    // Assert
    expect(result.canonicalPathRouteTemplatePaths).toEqual(['/journey/entry', '/journey/branch-b', '/journey/merge'])
  })

  it('should fall back to the first declared step when no active entry point exists', async () => {
    // Arrange
    const plan = createNavigationPlan([
      createCompiledNavigationStep({ nodeId: 'compile_ast:80', path: 'first' }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:81', path: 'second' }),
    ])

    // Act
    const result = await evaluate(plan, 'compile_ast:81')

    // Assert
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/first')
    expect(result.steps.every(step => !step.isReachable)).toBe(true)
  })

  it('should propagate reachability through every cascade-resolved forward edge when multiple submit hooks contribute', async () => {
    // Arrange
    const plan = createNavigationPlan([
      createCompiledNavigationStep({
        nodeId: 'compile_ast:85',
        path: 'entry',
        isEntryPoint: true,
        evaluateOutcomes: vi.fn().mockReturnValue(['add', 'check']),
      }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:88', path: 'add' }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:89', path: 'check' }),
    ])

    // Act
    const result = await evaluate(plan, 'compile_ast:89')

    // Assert
    expect(result.steps.find(step => step.stepNodeId === 'compile_ast:88')?.isReachable).toBe(true)
    expect(result.steps.find(step => step.stepNodeId === 'compile_ast:89')?.isReachable).toBe(true)
  })

  it('should keep predecessor edges visible for unreachable steps when the cascade narrows outcomes', async () => {
    // Arrange
    const plan = createNavigationPlan([
      createCompiledNavigationStep({
        nodeId: 'compile_ast:95',
        path: 'entry',
        isEntryPoint: true,
        evaluateOutcomes: vi.fn().mockReturnValue(['add']),
        declaredOutcomes: ['add', 'check'],
      }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:96', path: 'add' }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:97', path: 'check' }),
    ])

    // Act
    const result = await evaluate(plan, 'compile_ast:96')

    // Assert
    expect(result.steps.find(step => step.stepNodeId === 'compile_ast:96')?.isReachable).toBe(true)
    expect(result.steps.find(step => step.stepNodeId === 'compile_ast:97')?.isReachable).toBe(false)
    expect(result.steps.find(step => step.stepNodeId === 'compile_ast:95')?.declaredForwardRouteTemplatePaths).toEqual([
      '/journey/add',
      '/journey/check',
    ])
  })

  it('should mark all steps reachable and skip the BFS walk when reachabilityDisabled is true', async () => {
    // Arrange
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({ nodeId: 'compile_ast:90', path: 'page-one' }),
        createCompiledNavigationStep({ nodeId: 'compile_ast:91', path: 'page-two' }),
        createCompiledNavigationStep({ nodeId: 'compile_ast:92', path: 'page-three' }),
      ],
      { reachabilityDisabled: true },
    )

    // Act
    const result = await evaluate(plan, 'compile_ast:91')

    // Assert
    expect(result.steps.every(step => step.isReachable)).toBe(true)
    expect(result.defaultEntryRouteTemplatePath).toBe('/journey/page-one')
    expect(result.resumeOutcome).toBe('no-op')
  })

  it('should evaluate the resume predicate when resume is conditional', async () => {
    // Arrange
    const evaluateResumeWhen = vi.fn().mockReturnValue(true)
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({
          nodeId: 'compile_ast:110',
          path: 'entry',
          isEntryPoint: true,
          validationPlan: createNavigationValidationPlan(true),
          evaluateOutcomes: vi.fn().mockReturnValue(['next']),
        }),
        createCompiledNavigationStep({
          nodeId: 'compile_ast:112',
          path: 'next',
          validationPlan: createNavigationValidationPlan(false),
        }),
      ],
      { resumeConfigured: true, evaluateResumeWhen },
    )

    // Act
    const result = await evaluate(plan, 'compile_ast:110')

    // Assert
    expect(evaluateResumeWhen).toHaveBeenCalledTimes(1)
    expect(result.resumeActive).toBe(true)
    expect(result.resumeOutcome).toBe('redirect')
  })

  it('should await async compiled validation during reachability graph walking', async () => {
    // Arrange
    const validationSpy: CompiledFieldValidationFunction = vi.fn(async () => {
      await Promise.resolve()

      return []
    })
    const plan = createNavigationPlan(
      [
        createCompiledNavigationStep({
          nodeId: 'compile_ast:100',
          path: 'entry',
          isEntryPoint: true,
          validationPlan: {
            fieldValidations: [{ nodeId: 'compile_ast:999' as const, validate: validationSpy }],
            iteratorValidationGroups: [],
          },
          evaluateOutcomes: vi.fn().mockReturnValue(['next']),
        }),
        createCompiledNavigationStep({ nodeId: 'compile_ast:102', path: 'next' }),
      ],
      { resumeConfigured: true, resumeAlways: true },
    )

    // Act
    const result = await evaluate(plan, 'compile_ast:100')

    // Assert
    expect(validationSpy).toHaveBeenCalledTimes(1)
    expect(validationSpy).toHaveBeenCalledWith(expect.anything(), false, ['default'])
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/next')?.isReachable).toBe(true)
  })

  it('should record one unit per step and a resolution unit when tracing', async () => {
    // Arrange
    const recorder = new TraceRecorder()
    const plan = createNavigationPlan([
      createCompiledNavigationStep({ nodeId: 'compile_ast:120', path: 'start', isEntryPoint: true }),
      createCompiledNavigationStep({ nodeId: 'compile_ast:121', path: 'orphan' }),
    ])
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.navigationSteps)

    recorder.beginPhase('navigation')

    // Act
    await evaluateNavigation(
      plan,
      mockCtx,
      { currentStepNodeId: 'compile_ast:121', routeTemplateCatalog, redirectRule: 'step-post' },
      recorder,
    )
    recorder.endPhase('halt-redirect')

    // Assert
    const trace = recorder.finish('redirect')

    expect(trace.phases[0].units).toEqual([
      expect.objectContaining({ kind: 'navigation-step', nodeId: 'compile_ast:120', isReachable: true, isValid: true }),
      expect.objectContaining({
        kind: 'navigation-step',
        nodeId: 'compile_ast:121',
        isReachable: false,
        isValid: true,
      }),
      expect.objectContaining({ kind: 'navigation-resolution', resumeOutcome: 'no-op', redirect: '/journey/start' }),
    ])
  })
})

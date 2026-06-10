import { createNavigationPhase } from './navigationPhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { PipelineState } from '../types'
import type { NavigationRuntimeEntry, NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StepRequest } from '../../../../framework/types/request.type'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'

const createMockState = (): PipelineState => {
  const request = {
    method: 'GET',
    url: 'http://localhost/forms/journey/step',
    baseUrl: '/forms/journey',
    location: {
      origin: 'http://localhost',
      href: 'http://localhost/forms/journey/step',
      pathname: '/forms/journey/step',
      basePath: '/forms/journey',
    },
    getHeader: () => undefined,
    getAllHeaders: () => ({}),
    getCookie: () => undefined,
    getAllCookies: () => ({}),
    getParam: () => undefined,
    getParams: () => ({}),
    getQuery: () => undefined,
    getAllQuery: () => ({}),
    getPost: () => undefined,
    getAllPost: () => ({}),
    getSession: () => undefined,
    getState: () => undefined,
    getAllState: () => ({}),
  } as unknown as StepRequest
  const context = new RuntimeEvaluationContext(request)

  return { context, request, responseBindings: NO_OP_RESPONSE_BINDINGS }
}

const mockFunctionRegistry = {} as FunctionRegistry

const createEntry = (stepId: NodeId, overrides: Partial<NavigationRuntimeEntry> = {}): NavigationRuntimeEntry => ({
  stepId,
  isEntryPoint: false,
  hasValidation: false,
  cleardownFieldCodes: [],
  declaredOutcomes: [],
  ...overrides,
})

const createPlan = (
  entries: NavigationRuntimeEntry[],
  overrides: Partial<NavigationRuntimePlan> = {},
): NavigationRuntimePlan => ({
  entries,
  resumeConfigured: false,
  resumeAlways: false,
  unreachableRedirect: 'entry',
  reachabilityDisabled: false,
  stepValidationPlans: new Map(),
  ...overrides,
})

const createValidationPlan = (isValid: boolean): ValidationPlan => ({
  fields: [
    {
      nodeId: 'compile_ast:999' as const,
      validate: () =>
        isValid
          ? []
          : [{ blockId: 'compile_ast:999' as const, passed: false, message: 'invalid', submissionOnly: false }],
    },
  ],
  iteratorGroups: [],
})

const createCatalog = (paths: Array<[NodeId, string]>): JourneyRouteTemplateCatalog => ({
  routeTemplatePathByStepId: new Map(paths),
  stepIdByRouteTemplatePath: new Map(paths.map(([stepId, path]) => [path, stepId])),
})

describe('navigationPhase', () => {
  describe('execute()', () => {
    it('should return continue and store the evaluation when the current step is reachable', async () => {
      // Arrange
      const plan = createPlan([createEntry('compile_ast:1' as const, { isEntryPoint: true })])
      const catalog = createCatalog([['compile_ast:1' as const, '/journey/step-one']])
      const phase = createNavigationPhase(plan, 'compile_ast:1' as const, catalog, 'step-get', mockFunctionRegistry)

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.navigationEvaluation?.steps.map(step => step.isReachable)).toEqual([true])
    })

    it('should return halt-redirect with reason unreachable when the current step is not reachable', async () => {
      // Arrange
      const plan = createPlan([
        createEntry('compile_ast:1' as const, { isEntryPoint: true }),
        createEntry('compile_ast:2' as const),
      ])
      const catalog = createCatalog([
        ['compile_ast:1' as const, '/journey/step-one'],
        ['compile_ast:2' as const, '/journey/step-two'],
      ])
      const phase = createNavigationPhase(plan, 'compile_ast:2' as const, catalog, 'step-get', mockFunctionRegistry)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/journey/step-one', reason: 'unreachable' })
    })

    it('should return halt-redirect with reason resume when resume wants to move the user', async () => {
      // Arrange
      const plan = createPlan(
        [
          createEntry('compile_ast:1' as const, {
            isEntryPoint: true,
            hasValidation: true,
            evaluateOutcomes: vi.fn().mockReturnValue(['step-two']),
          }),
          createEntry('compile_ast:2' as const, { hasValidation: true }),
        ],
        {
          resumeConfigured: true,
          resumeAlways: true,
          stepValidationPlans: new Map<NodeId, ValidationPlan>([
            ['compile_ast:1' as const, createValidationPlan(true)],
            ['compile_ast:2' as const, createValidationPlan(false)],
          ]),
        },
      )
      const catalog = createCatalog([
        ['compile_ast:1' as const, '/journey/step-one'],
        ['compile_ast:2' as const, '/journey/step-two'],
      ])
      const phase = createNavigationPhase(plan, 'compile_ast:1' as const, catalog, 'step-get', mockFunctionRegistry)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/journey/step-two', reason: 'resume' })
    })

    it('should store projected reachability on the context when params are present', async () => {
      // Arrange
      const plan = createPlan([createEntry('compile_ast:1' as const, { isEntryPoint: true })])
      const catalog = createCatalog([['compile_ast:1' as const, '/journey/step-one']])
      const phase = createNavigationPhase(plan, 'compile_ast:1' as const, catalog, 'step-get', mockFunctionRegistry)

      // Act
      const state = createMockState()
      await phase.execute(state)

      // Assert
      expect(state.context.global.reachability).toBeDefined()
    })

    it('should record navigation-step and navigation-resolution units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan = createPlan([
        createEntry('compile_ast:1' as const, { isEntryPoint: true }),
        createEntry('compile_ast:2' as const),
      ])
      const catalog = createCatalog([
        ['compile_ast:1' as const, '/journey/step-one'],
        ['compile_ast:2' as const, '/journey/step-two'],
      ])
      const phase = createNavigationPhase(plan, 'compile_ast:1' as const, catalog, 'step-get', mockFunctionRegistry)

      recorder.beginPhase('navigation')

      // Act
      await phase.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        { kind: 'navigation-step', nodeId: 'compile_ast:1', isReachable: true, isValid: true },
        { kind: 'navigation-step', nodeId: 'compile_ast:2', isReachable: false, isValid: true },
        expect.objectContaining({ kind: 'navigation-resolution', resumeOutcome: 'no-op', redirect: undefined }),
      ])
    })

    it('should record the resolved redirect target on the navigation-resolution unit when redirecting', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan = createPlan([
        createEntry('compile_ast:1' as const, { isEntryPoint: true }),
        createEntry('compile_ast:2' as const),
      ])
      const catalog = createCatalog([
        ['compile_ast:1' as const, '/journey/step-one'],
        ['compile_ast:2' as const, '/journey/step-two'],
      ])
      const phase = createNavigationPhase(plan, 'compile_ast:2' as const, catalog, 'step-get', mockFunctionRegistry)

      recorder.beginPhase('navigation')

      // Act
      await phase.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('halt-redirect')

      // Assert
      const trace = recorder.finish('redirect')

      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'navigation-step', nodeId: 'compile_ast:1', isReachable: true }),
        expect.objectContaining({ kind: 'navigation-step', nodeId: 'compile_ast:2', isReachable: false }),
        expect.objectContaining({
          kind: 'navigation-resolution',
          resumeOutcome: 'no-op',
          redirect: '/journey/step-one',
        }),
      ])
    })
  })
})

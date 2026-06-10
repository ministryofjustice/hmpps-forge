import { createJourneyRedirectTerminal } from './journeyRedirectTerminal'
import TraceRecorder from '../trace/TraceRecorder'
import type { PipelineState } from '../types'
import type { NavigationRuntimeEntry, NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StepRequest } from '../../../../framework/types/request.type'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'

const createMockState = (params: Record<string, string> = {}): PipelineState => {
  const request = {
    method: 'GET',
    url: 'http://localhost/journey',
    baseUrl: '/journey',
    location: {
      origin: 'http://localhost',
      href: 'http://localhost/journey',
      pathname: '/journey',
      basePath: '/journey',
    },
    getHeader: () => undefined,
    getAllHeaders: () => ({}),
    getCookie: () => undefined,
    getAllCookies: () => ({}),
    getParam: (name: string) => params[name],
    getParams: () => params,
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

const createPlan = (entries: NavigationRuntimeEntry[]): NavigationRuntimePlan => ({
  entries,
  resumeConfigured: false,
  resumeAlways: false,
  unreachableRedirect: 'entry',
  reachabilityDisabled: false,
  stepValidationPlans: new Map(),
})

const createCatalog = (paths: Array<[NodeId, string]>): JourneyRouteTemplateCatalog => ({
  routeTemplatePathByStepId: new Map(paths),
  stepIdByRouteTemplatePath: new Map(paths.map(([stepId, path]) => [path, stepId])),
})

describe('journeyRedirectTerminal', () => {
  describe('execute()', () => {
    it('should redirect to the resolved entry step', async () => {
      // Arrange
      const plan = createPlan([createEntry('compile_ast:1' as const, { isEntryPoint: true })])
      const catalog = createCatalog([['compile_ast:1' as const, '/journey/first-step']])
      const terminal = createJourneyRedirectTerminal(plan, catalog, mockFunctionRegistry)

      // Act
      const result = await terminal.execute(createMockState())

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/journey/first-step' })
    })

    it('should interpolate path params in redirect target', async () => {
      // Arrange
      const plan = createPlan([createEntry('compile_ast:1' as const, { isEntryPoint: true })])
      const catalog = createCatalog([['compile_ast:1' as const, '/journey/:personId/first-step']])
      const terminal = createJourneyRedirectTerminal(plan, catalog, mockFunctionRegistry)

      // Act
      const result = await terminal.execute(createMockState({ personId: '42' }))

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/journey/42/first-step' })
    })

    it('should throw when no steps are found', async () => {
      // Arrange
      const terminal = createJourneyRedirectTerminal(createPlan([]), createCatalog([]), mockFunctionRegistry)

      // Act & Assert
      await expect(terminal.execute(createMockState())).rejects.toThrow('No steps found in journey')
    })

    it('should record navigation units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan = createPlan([createEntry('compile_ast:1' as const, { isEntryPoint: true })])
      const catalog = createCatalog([['compile_ast:1' as const, '/journey/first-step']])
      const terminal = createJourneyRedirectTerminal(plan, catalog, mockFunctionRegistry)

      recorder.beginPhase('journey-redirect')

      // Act
      await terminal.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('redirect')

      // Assert
      const trace = recorder.finish('redirect')

      expect(trace.phases[0].units).toEqual([
        { kind: 'navigation-step', nodeId: 'compile_ast:1', isReachable: true, isValid: true },
        expect.objectContaining({
          kind: 'navigation-resolution',
          resumeOutcome: 'no-op',
          redirect: '/journey/first-step',
        }),
      ])
    })
  })
})

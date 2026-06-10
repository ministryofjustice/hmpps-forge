import { createJourneyRedirectTerminal } from './journeyRedirectTerminal'
import TraceRecorder from '../trace/TraceRecorder'
import type { PipelineState } from '../types'
import type { NavigationEvaluation, NavigationStepState } from '../../../contracts/navigation/navigationEvaluation.type'
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

const createMockEvaluation = (overrides: Partial<NavigationEvaluation> = {}): NavigationEvaluation => ({
  currentStepId: undefined,
  steps: [],
  defaultEntryRouteTemplatePath: '/journey/first-step',
  frontierRouteTemplatePath: undefined,
  canonicalPathRouteTemplatePaths: [],
  progressExists: false,
  resumeActive: false,
  resumeOutcome: 'no-op',
  unreachableRedirect: 'entry',
  ...overrides,
})

describe('journeyRedirectTerminal', () => {
  describe('execute()', () => {
    it('should redirect to the resolved entry step', async () => {
      // Arrange
      const evaluation = createMockEvaluation({ defaultEntryRouteTemplatePath: '/journey/first-step' })
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const terminal = createJourneyRedirectTerminal(compiledFn, {} as never, {} as never, mockFunctionRegistry)

      // Act
      const result = await terminal.execute(createMockState())

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/journey/first-step' })
    })

    it('should interpolate path params in redirect target', async () => {
      // Arrange
      const evaluation = createMockEvaluation({
        defaultEntryRouteTemplatePath: '/journey/:personId/first-step',
      })
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const terminal = createJourneyRedirectTerminal(compiledFn, {} as never, {} as never, mockFunctionRegistry)

      // Act
      const result = await terminal.execute(createMockState({ personId: '42' }))

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/journey/42/first-step' })
    })

    it('should record navigation units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const entryStep: NavigationStepState = {
        stepId: 'compile_ast:1' as const,
        routeTemplatePath: '/journey/first-step',
        declarationIndex: 0,
        isEntryPoint: true,
        isConditionalEntry: false,
        hasValidation: false,
        isReachable: true,
        isValid: true,
        forwardRouteTemplatePaths: [],
        predecessorRouteTemplatePaths: [],
      }
      const evaluation = createMockEvaluation({ steps: [entryStep] })
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const terminal = createJourneyRedirectTerminal(compiledFn, {} as never, {} as never, mockFunctionRegistry)

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

    it('should throw when no steps are found', async () => {
      // Arrange
      const evaluation = createMockEvaluation({
        defaultEntryRouteTemplatePath: undefined,
        frontierRouteTemplatePath: undefined,
      })
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const terminal = createJourneyRedirectTerminal(compiledFn, {} as never, {} as never, mockFunctionRegistry)

      // Act & Assert
      await expect(terminal.execute(createMockState())).rejects.toThrow('No steps found in journey')
    })

    it('should throw when compiled function is missing', async () => {
      // Arrange
      const terminal = createJourneyRedirectTerminal(undefined, {} as never, {} as never, mockFunctionRegistry)

      // Act & Assert
      await expect(terminal.execute(createMockState())).rejects.toThrow(
        'compiledNavigation function is missing from plan',
      )
    })
  })
})

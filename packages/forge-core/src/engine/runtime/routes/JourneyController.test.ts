import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { CompilationArtefact } from '../../compilation/CompilationFactory'
import { JourneyRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluator from '../../compilation/thunks/ThunkEvaluator'
import ContextPreparer from '../preparation/ContextPreparer'
import AnswerPreparer from '../preparation/AnswerPreparer'
import HookExecutor from '../evaluation/HookExecutor'
import StepValidityAnalyzer from '../evaluation/StepValidityAnalyzer'
import NavigationAnalyzer from '../analysis/NavigationAnalyzer'
import JourneyController from './JourneyController'
import { StepRequest, CookieMutation, CookieOptions, StepResponse } from '../../../framework'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'

vi.mock('../../compilation/thunks/ThunkEvaluator')

const mockContextPreparerPrepare = vi.fn()
const mockAnswerPreparerPrepare = vi.fn().mockResolvedValue(undefined)
const mockHookExecutorExecuteAccessLifecycle = vi.fn()
const mockNavigationAnalyzerEvaluate = vi.fn()

vi.mock('../preparation/ContextPreparer', () => ({
  __esModule: true,
  default: vi.fn(function MockContextPreparer() {
    return {
      prepare: (...args: unknown[]) => mockContextPreparerPrepare(...args),
    }
  }),
}))

vi.mock('../preparation/AnswerPreparer', () => ({
  __esModule: true,
  default: vi.fn(function MockAnswerPreparer() {
    return {
      prepare: (...args: unknown[]) => mockAnswerPreparerPrepare(...args),
    }
  }),
}))

vi.mock('../evaluation/HookExecutor', () => ({
  __esModule: true,
  default: vi.fn(function MockHookExecutor() {
    return {
      executeAccessLifecycle: (...args: unknown[]) => mockHookExecutorExecuteAccessLifecycle(...args),
    }
  }),
}))

vi.mock('../evaluation/StepValidityAnalyzer', () => ({
  __esModule: true,
  default: vi.fn(function MockStepValidityAnalyzer() {
    return {
      execute: vi.fn(),
    }
  }),
}))

vi.mock('../analysis/NavigationAnalyzer', () => ({
  __esModule: true,
  default: vi.fn(function MockNavigationAnalyzer() {
    return {
      evaluate: (...args: unknown[]) => mockNavigationAnalyzerEvaluate(...args),
    }
  }),
}))

const createMockRequest = (
  overrides: Partial<{
    params: Record<string, string>
    url: string
  }> = {},
): StepRequest => {
  const params = overrides.params ?? {}
  const url = overrides.url ?? 'http://localhost/forms/journey/'
  const parsedUrl = new URL(url, 'http://localhost')

  return {
    method: 'GET',
    url,
    baseUrl: '/forms/journey',
    location: {
      origin: parsedUrl.origin,
      href: parsedUrl.href,
      pathname: parsedUrl.pathname,
      basePath: '/forms/journey',
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
  }
}

const createMockResponse = (): StepResponse => {
  const responseHeaders = new Map<string, string>()
  const responseCookies = new Map<string, CookieMutation>()

  return {
    setHeader: (name: string, value: string) => {
      responseHeaders.set(name, value)
    },
    getHeader: (name: string) => responseHeaders.get(name),
    getAllHeaders: () => responseHeaders,
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      responseCookies.set(name, { value, options })
    },
    getCookie: (name: string) => responseCookies.get(name),
    getAllCookies: () => responseCookies,
  }
}

describe('JourneyController', () => {
  let mockJourneyPlan: JourneyRuntimePlan
  let mockArtefact: CompilationArtefact
  let mockDependencies: Mocked<JourneyInstanceDependencies>
  let mockCatalog: JourneyRouteTemplateCatalog
  let mockReq: unknown
  let mockRes: unknown

  beforeEach(() => {
    mockContextPreparerPrepare.mockReset()
    mockAnswerPreparerPrepare.mockClear()
    mockHookExecutorExecuteAccessLifecycle.mockReset()
    mockNavigationAnalyzerEvaluate.mockReset()
    ;(ContextPreparer as unknown as Mock).mockClear()
    ;(AnswerPreparer as unknown as Mock).mockClear()
    ;(HookExecutor as unknown as Mock).mockClear()
    ;(NavigationAnalyzer as unknown as Mock).mockClear()
    ;(StepValidityAnalyzer as unknown as Mock).mockClear()

    mockJourneyPlan = {
      journeyId: 'compile_ast:journey' as NodeId,
      path: '/journey',
      accessAncestorIds: ['compile_ast:root-journey' as NodeId, 'compile_ast:journey' as NodeId],
      fieldIteratorRootIds: [],
      reachabilityPlan: { entries: [], resumeAlways: false, reachabilityDisabled: false },
    }

    mockArtefact = {} as CompilationArtefact

    mockCatalog = {
      routeTemplatePathByStepId: new Map(),
      stepIdByRouteTemplatePath: new Map(),
    }

    mockDependencies = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      frameworkAdapter: {
        redirect: vi.fn(),
        toStepRequest: vi.fn().mockImplementation(() => createMockRequest()),
        toStepResponse: vi.fn().mockImplementation(createMockResponse),
      },
      componentRegistry: {} as any,
      functionRegistry: {} as any,
    } as unknown as Mocked<JourneyInstanceDependencies>

    mockReq = {}
    mockRes = {}

    mockContextPreparerPrepare.mockReturnValue({})
    ;(ThunkEvaluator as unknown as { withRuntimeOverlay: Mock }).withRuntimeOverlay = vi.fn().mockReturnValue({})
  })

  describe('get()', () => {
    const createStepState = (
      overrides: Partial<{
        stepId: NodeId
        routeTemplatePath: string
        isEntryPoint: boolean
        isConditionalEntry: boolean
        tieBreakerPriority: number
      }> = {},
    ) => ({
      stepId: (overrides.stepId ?? 'compile_ast:step-1') as NodeId,
      routeTemplatePath: overrides.routeTemplatePath ?? '/journey/step-1',
      declarationIndex: 0,
      isEntryPoint: overrides.isEntryPoint ?? false,
      isConditionalEntry: overrides.isConditionalEntry ?? false,
      hasValidation: false,
      isReachable: true,
      isValid: true,
      forwardRouteTemplatePaths: [],
      predecessorRouteTemplatePaths: [],
      tieBreakerPriority: overrides.tieBreakerPriority,
    })

    const createEvaluation = (overrides: Record<string, unknown>) => ({
      currentStepId: undefined,
      steps: [createStepState()],
      defaultEntryRouteTemplatePath: '/journey/step-1',
      frontierRouteTemplatePath: undefined,
      canonicalPathRouteTemplatePaths: ['/journey/step-1'],
      progressExists: false,
      resumeActive: false,
      resumeOutcome: 'no-op' as const,
      ...overrides,
    })

    it('should redirect to resume frontier when resumeWhen is always active', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          frontierRouteTemplatePath: '/journey/resume-target',
          resumeActive: true,
          resumeOutcome: 'redirect',
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/journey/resume-target')
    })

    it('should redirect to winning entry point when resume is not active', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [
            createStepState({ routeTemplatePath: '/journey/overview', isEntryPoint: true }),
            createStepState({
              stepId: 'compile_ast:step-2' as NodeId,
              routeTemplatePath: '/journey/your-name',
              isEntryPoint: true,
              tieBreakerPriority: 100,
            }),
          ],
          defaultEntryRouteTemplatePath: '/journey/your-name',
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/journey/your-name')
    })

    it('should fall back to entry point when resume is active but frontier is undefined', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [createStepState({ routeTemplatePath: '/journey/first', isEntryPoint: true })],
          defaultEntryRouteTemplatePath: '/journey/first',
          resumeActive: true,
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/journey/first')
    })

    it('should fall back to first step when no entry points exist', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [createStepState({ routeTemplatePath: '/journey/step-a' })],
          defaultEntryRouteTemplatePath: '/journey/step-a',
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/journey/step-a')
    })

    it('should throw when no steps exist', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [],
          defaultEntryRouteTemplatePath: undefined,
          canonicalPathRouteTemplatePaths: [],
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act & Assert
      await expect(controller.get(mockReq, mockRes)).rejects.toMatchObject({
        status: 500,
        message: expect.stringContaining('No steps'),
      })
    })

    it('should run access lifecycle before preparing answers and evaluating navigation', async () => {
      // Arrange
      const callOrder: string[] = []

      mockHookExecutorExecuteAccessLifecycle.mockImplementation(async () => {
        callOrder.push('hooks')

        return { outcome: 'continue', executed: true }
      })
      mockAnswerPreparerPrepare.mockImplementation(async () => {
        callOrder.push('answers')
      })
      mockNavigationAnalyzerEvaluate.mockImplementation(async () => {
        callOrder.push('navigation')

        return createEvaluation({
          steps: [createStepState({ isEntryPoint: true })],
          defaultEntryRouteTemplatePath: '/journey/target',
        })
      })

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(callOrder).toEqual(['hooks', 'answers', 'navigation'])
    })

    it('should honour a redirect outcome from the access lifecycle without running downstream work', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({
        outcome: 'redirect',
        executed: true,
        redirect: '/login',
      })

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockAnswerPreparerPrepare).not.toHaveBeenCalled()
      expect(mockNavigationAnalyzerEvaluate).not.toHaveBeenCalled()
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalled()
    })

    it('should throw an HTTP error when the access lifecycle returns an error outcome', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({
        outcome: 'error',
        executed: true,
        status: 403,
        message: 'Access denied',
      })

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act & Assert
      await expect(controller.get(mockReq, mockRes)).rejects.toMatchObject({ status: 403, message: 'Access denied' })
    })

    it('should interpolate path params from the request into the redirect URL', async () => {
      // Arrange
      ;(mockDependencies.frameworkAdapter.toStepRequest as Mock).mockImplementation(() =>
        createMockRequest({ params: { personId: 'abc-123' } }),
      )
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          frontierRouteTemplatePath: '/journey/people/:personId/details',
          resumeActive: true,
          resumeOutcome: 'redirect',
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(
        mockRes,
        '/journey/people/abc-123/details',
      )
    })

    it('should invoke NavigationAnalyzer with an undefined currentStepId', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [createStepState({ isEntryPoint: true })],
          defaultEntryRouteTemplatePath: '/journey/any',
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockNavigationAnalyzerEvaluate).toHaveBeenCalledWith(
        mockJourneyPlan.reachabilityPlan,
        undefined,
        mockCatalog,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
    })

    it('should include conditional entries when selecting the winning entry point', async () => {
      // Arrange
      mockHookExecutorExecuteAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [
            createStepState({ routeTemplatePath: '/journey/start', isEntryPoint: true }),
            createStepState({
              stepId: 'compile_ast:step-2' as NodeId,
              routeTemplatePath: '/journey/confirmation',
              isConditionalEntry: true,
              tieBreakerPriority: 200,
            }),
          ],
          defaultEntryRouteTemplatePath: '/journey/confirmation',
        }),
      )

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/journey/confirmation')
    })
  })
})

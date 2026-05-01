import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { CompilationArtefact } from '../../compilation/CompilationFactory'
import { JourneyRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ContextPreparer from '../lifecycle/ContextPreparer'
import NavigationAnalyzer from '../navigation/NavigationAnalyzer'
import JourneyController from './JourneyController'
import { StepRequest, CookieMutation, CookieOptions, StepResponse } from '../../../framework'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'

const mockContextPreparerPrepare = vi.fn()
const mockCompiledAnswerPreparation = vi.fn()
const mockCompiledAccessLifecycle = vi.fn()
const mockNavigationAnalyzerEvaluate = vi.fn()

vi.mock('../lifecycle/ContextPreparer', () => ({
  __esModule: true,
  default: vi.fn(function MockContextPreparer() {
    return {
      prepare: (...args: unknown[]) => mockContextPreparerPrepare(...args),
    }
  }),
}))

vi.mock('../navigation/NavigationAnalyzer', () => ({
  __esModule: true,
  default: vi.fn(function MockNavigationAnalyzer() {
    return {
      evaluate: (...args: unknown[]) => mockNavigationAnalyzerEvaluate(...args),
    }
  }),
  resolveJourneyRootRedirect: (evaluation: {
    resumeOutcome: string
    frontierRouteTemplatePath?: string
    defaultEntryRouteTemplatePath?: string
  }) => {
    if (evaluation.resumeOutcome === 'redirect') {
      return evaluation.frontierRouteTemplatePath
    }

    return evaluation.defaultEntryRouteTemplatePath
  },
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
    mockCompiledAnswerPreparation.mockClear()
    mockCompiledAccessLifecycle.mockReset()
    mockNavigationAnalyzerEvaluate.mockReset()
    ;(ContextPreparer as unknown as Mock).mockClear()
    ;(NavigationAnalyzer as unknown as Mock).mockClear()

    mockJourneyPlan = {
      path: '/journey',
      accessAncestorIds: ['compile_ast:root-journey' as NodeId, 'compile_ast:journey' as NodeId],
      compiledAccessLifecycle: (...args: unknown[]) => mockCompiledAccessLifecycle(...args),
      compiledAnswerPreparation: mockCompiledAnswerPreparation,
      reachabilityPlan: {
        entries: [],
        resumeAlways: false,
        reachabilityDisabled: false,
        compiledReachability: () => ({
          entryResults: [],
          outcomeValues: [],
          tieBreakerPriorities: [],
          resumeActive: false,
        }),
      },
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

    mockContextPreparerPrepare.mockReturnValue({
      global: { answers: {}, data: {} },
      request: {
        url: 'http://localhost/forms/journey/',
        method: 'GET',
        location: {
          origin: 'http://localhost',
          pathname: '/forms/journey/',
          href: 'http://localhost/forms/journey/',
          basePath: '/forms/journey',
        },
        getParams: () => ({}),
        getSession: () => undefined,
        getAllQuery: () => ({}),
        getAllHeaders: () => ({}),
        getAllCookies: () => ({}),
        getAllState: () => ({}),
        getAllPost: () => ({}),
      },
    })
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
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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

    it('should run access lifecycle before compiled answer preparation and navigation', async () => {
      // Arrange
      const callOrder: string[] = []

      mockCompiledAccessLifecycle.mockImplementation(async () => {
        callOrder.push('hooks')

        return { outcome: 'continue', executed: true }
      })
      mockCompiledAnswerPreparation.mockImplementation(() => {
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

    it('should call compiled answer preparation with request context', async () => {
      // Arrange
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [createStepState({ isEntryPoint: true })],
          defaultEntryRouteTemplatePath: '/journey/target',
        }),
      )
      mockContextPreparerPrepare.mockReturnValue({
        global: { answers: {}, data: { draw: 'abc' } },
        request: {
          url: 'http://localhost/forms/journey/?returnUrl=/home',
          method: 'GET',
          location: {
            origin: 'http://localhost',
            pathname: '/forms/journey/',
            href: 'http://localhost/forms/journey/?returnUrl=/home',
            basePath: '/forms/journey',
          },
          getParams: () => ({ journeyId: 'visit' }),
          getSession: () => ({ userId: 'user-1' }),
          getAllQuery: () => ({ returnUrl: '/home' }),
          getAllHeaders: () => ({ accept: 'text/html' }),
          getAllCookies: () => ({ session: 'abc' }),
          getAllState: () => ({ csrf: 'token' }),
          getAllPost: () => ({}),
        },
      })

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockCompiledAnswerPreparation).toHaveBeenCalledWith({
        answers: {},
        data: { draw: 'abc' },
        session: { userId: 'user-1' },
        params: { journeyId: 'visit' },
        query: { returnUrl: '/home' },
        request: {
          url: 'http://localhost/forms/journey/?returnUrl=/home',
          path: '/forms/journey/',
          method: 'GET',
          headers: { accept: 'text/html' },
          cookies: { session: 'abc' },
          state: { csrf: 'token' },
        },
        conditions: mockDependencies.functionRegistry,
        post: {},
      })
    })

    it('should await async journey answer preparation before reachability and navigation', async () => {
      // Arrange
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockNavigationAnalyzerEvaluate.mockResolvedValue(
        createEvaluation({
          steps: [createStepState({ isEntryPoint: true })],
          defaultEntryRouteTemplatePath: '/journey/target',
        }),
      )

      const compiledReachabilitySpy = vi.fn(ctx => {
        expect(ctx.answers.prepared.current).toBe('yes')

        return {
          entryResults: [],
          outcomeValues: [],
          tieBreakerPriorities: [],
          resumeActive: false,
        }
      })

      mockJourneyPlan.compiledAnswerPreparation = async ctx => {
        await Promise.resolve()
        ctx.answers.prepared = { current: 'yes', mutations: [] }
      }
      mockJourneyPlan.reachabilityPlan.compiledReachability = compiledReachabilitySpy

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(compiledReachabilitySpy).toHaveBeenCalledTimes(1)
      expect(mockNavigationAnalyzerEvaluate).toHaveBeenCalled()
    })

    it('should throw when compiled answer preparation is missing', async () => {
      // Arrange
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
      mockJourneyPlan.compiledAnswerPreparation = undefined

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act & Assert
      await expect(controller.get(mockReq, mockRes)).rejects.toThrow(
        'Journey answer preparation compilation is required',
      )
    })

    it('should honour a redirect outcome from the access lifecycle without running downstream work', async () => {
      // Arrange
      mockCompiledAccessLifecycle.mockResolvedValue({
        outcome: 'redirect',
        executed: true,
        redirect: '/login',
      })

      const controller = new JourneyController(mockJourneyPlan, mockArtefact, mockDependencies, mockCatalog)

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockCompiledAnswerPreparation).not.toHaveBeenCalled()
      expect(mockNavigationAnalyzerEvaluate).not.toHaveBeenCalled()
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalled()
    })

    it('should throw an HTTP error when the access lifecycle returns an error outcome', async () => {
      // Arrange
      mockCompiledAccessLifecycle.mockResolvedValue({
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
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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
        mockDependencies.functionRegistry,
      )
    })

    it('should include conditional entries when selecting the winning entry point', async () => {
      // Arrange
      mockCompiledAccessLifecycle.mockResolvedValue({ outcome: 'continue', executed: true })
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

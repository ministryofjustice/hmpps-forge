import { createNavigationPhase } from './navigationPhase'
import type { PipelineState } from '../types'
import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { StepResponse } from '../../../../framework/types/response.type'

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
  const response = {} as StepResponse
  const context = new RuntimeEvaluationContext(request, response)

  return { context, request }
}

const mockFunctionRegistry = {} as FunctionRegistry
const mockInstrumentation = {
  span: vi.fn(
    (_n: string, fn: (s: { setAttribute: () => void; setAttributes: () => void; addEvent: () => void }) => unknown) =>
      fn({ setAttribute: vi.fn(), setAttributes: vi.fn(), addEvent: vi.fn() }),
  ),
  spanAsync: vi.fn(
    async (
      _n: string,
      fn: (s: { setAttribute: () => void; setAttributes: () => void; addEvent: () => void }) => Promise<unknown>,
    ) => fn({ setAttribute: vi.fn(), setAttributes: vi.fn(), addEvent: vi.fn() }),
  ),
} as unknown as ForgeInstrumentation

const createMockEvaluation = (): NavigationEvaluation => ({
  currentStepId: 'compile_ast:1' as const,
  steps: [],
  defaultEntryRouteTemplatePath: undefined,
  frontierRouteTemplatePath: undefined,
  canonicalPathRouteTemplatePaths: [],
  progressExists: false,
  resumeActive: false,
  resumeOutcome: 'no-op',
  unreachableRedirect: 'entry',
})

describe('navigationPhase', () => {
  describe('execute()', () => {
    it('should return continue when no redirect is resolved', async () => {
      // Arrange
      const evaluation = createMockEvaluation()
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const resolveRedirect = vi.fn().mockReturnValue(undefined)
      const phase = createNavigationPhase(
        compiledFn,
        {} as never,
        'compile_ast:1' as const,
        {} as never,
        resolveRedirect,
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.navigationEvaluation).toBe(evaluation)
    })

    it('should return halt-redirect when redirect resolver returns a path', async () => {
      // Arrange
      const evaluation = createMockEvaluation()
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const resolveRedirect = vi.fn().mockReturnValue('/other-step')
      const phase = createNavigationPhase(
        compiledFn,
        {} as never,
        'compile_ast:1' as const,
        {} as never,
        resolveRedirect,
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/other-step', reason: 'unreachable' })
    })

    it('should store reachability on context when present', async () => {
      // Arrange
      const reachability = { steps: new Map() }
      const evaluation = createMockEvaluation()
      const compiledFn = vi.fn().mockResolvedValue({ evaluation, reachability })
      const resolveRedirect = vi.fn().mockReturnValue(undefined)
      const phase = createNavigationPhase(
        compiledFn,
        {} as never,
        'compile_ast:1' as const,
        {} as never,
        resolveRedirect,
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const state = createMockState()
      await phase.execute(state)

      // Assert
      expect(state.context.global.reachability).toBe(reachability)
    })

    it('should throw when compiled function is missing', async () => {
      // Arrange
      const phase = createNavigationPhase(
        undefined,
        {} as never,
        'compile_ast:1' as const,
        {} as never,
        vi.fn(),
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('compiledNavigation function is missing from plan')
    })

    it('should record reachability span with navigation attributes and per-step events', async () => {
      // Arrange
      const setAttributes = vi.fn()
      const addEvent = vi.fn()
      const instrumentation = {
        span: vi.fn(
          (_n: string, fn: (s: { setAttributes: typeof setAttributes; addEvent: typeof addEvent }) => unknown) =>
            fn({ setAttributes, addEvent }),
        ),
      } as unknown as ForgeInstrumentation
      const evaluation: NavigationEvaluation = {
        currentStepId: 'compile_ast:1' as const,
        steps: [
          {
            stepId: 'compile_ast:1' as const,
            routeTemplatePath: '/journey/step-1',
            declarationIndex: 0,
            isEntryPoint: true,
            isConditionalEntry: false,
            hasValidation: true,
            isValid: true,
            isReachable: true,
            forwardRouteTemplatePaths: ['/journey/step-2'],
            predecessorRouteTemplatePaths: [],
          },
        ],
        defaultEntryRouteTemplatePath: '/journey/step-1',
        frontierRouteTemplatePath: '/journey/step-1',
        canonicalPathRouteTemplatePaths: ['/journey/step-1'],
        progressExists: true,
        resumeActive: false,
        resumeOutcome: 'no-op',
        unreachableRedirect: 'entry',
      }
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const phase = createNavigationPhase(
        compiledFn,
        {} as never,
        'compile_ast:1' as const,
        {} as never,
        vi.fn().mockReturnValue(undefined),
        mockFunctionRegistry,
        instrumentation,
      )

      // Act
      await phase.execute(createMockState())

      // Assert
      expect(instrumentation.span).toHaveBeenCalledWith('reachability', expect.any(Function))
      expect(setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'forge.navigation.currentStepId': 'compile_ast:1',
          'forge.navigation.defaultEntry': '/journey/step-1',
          'forge.navigation.frontier': '/journey/step-1',
          'forge.navigation.progressExists': true,
          'forge.navigation.resumeActive': false,
          'forge.navigation.resumeOutcome': 'no-op',
          'forge.navigation.reachableCount': 1,
          'forge.navigation.unreachableCount': 0,
        }),
      )
      expect(addEvent).toHaveBeenCalledTimes(1)
      expect(addEvent).toHaveBeenCalledWith(
        'forge.navigation.step',
        expect.objectContaining({
          'forge.navigation.step.id': 'compile_ast:1',
          'forge.navigation.step.routeTemplatePath': '/journey/step-1',
          'forge.navigation.step.isReachable': true,
          'forge.navigation.step.isValid': true,
          'forge.navigation.step.forwardRouteTemplatePaths': ['/journey/step-2'],
          'forge.navigation.step.predecessorRouteTemplatePaths': [],
        }),
      )
    })

    it('should emit validation-failure events for steps the reachability walk found invalid', async () => {
      // Arrange
      const addEvent = vi.fn()
      const instrumentation = {
        span: vi.fn((_n: string, fn: (s: { setAttributes: () => void; addEvent: typeof addEvent }) => unknown) =>
          fn({ setAttributes: vi.fn(), addEvent }),
        ),
      } as unknown as ForgeInstrumentation
      const evaluation: NavigationEvaluation = {
        currentStepId: 'compile_ast:1' as const,
        steps: [
          {
            stepId: 'compile_ast:2' as const,
            routeTemplatePath: '/journey/step-2',
            declarationIndex: 1,
            isEntryPoint: false,
            isConditionalEntry: false,
            hasValidation: true,
            isValid: false,
            isReachable: true,
            forwardRouteTemplatePaths: [],
            predecessorRouteTemplatePaths: ['/journey/step-1'],
            fieldFailures: [
              { blockId: 'compile_ast:3' as const, passed: false, message: 'Required', submissionOnly: false },
            ],
            domainFailures: [],
          },
        ],
        defaultEntryRouteTemplatePath: '/journey/step-1',
        frontierRouteTemplatePath: '/journey/step-1',
        canonicalPathRouteTemplatePaths: ['/journey/step-1'],
        progressExists: true,
        resumeActive: false,
        resumeOutcome: 'no-op',
        unreachableRedirect: 'entry',
      }
      const compiledFn = vi.fn().mockResolvedValue({ evaluation })
      const phase = createNavigationPhase(
        compiledFn,
        {} as never,
        'compile_ast:1' as const,
        {} as never,
        vi.fn().mockReturnValue(undefined),
        mockFunctionRegistry,
        instrumentation,
      )

      // Act
      await phase.execute(createMockState())

      // Assert
      expect(addEvent).toHaveBeenCalledWith(
        'forge.navigation.step',
        expect.objectContaining({
          'forge.navigation.step.id': 'compile_ast:2',
          'forge.navigation.step.isValid': false,
        }),
      )
      expect(addEvent).toHaveBeenCalledWith(
        'forge.validation.failure',
        expect.objectContaining({
          'forge.validation.failure.stepId': 'compile_ast:2',
          'forge.validation.failure.scope': 'field',
          'forge.validation.failure.message': 'Required',
          'forge.validation.failure.blockId': 'compile_ast:3',
        }),
      )
    })
  })
})

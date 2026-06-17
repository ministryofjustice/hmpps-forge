import { createNavigationPhase } from './navigationPhase'
import type { PipelineState } from '../types'
import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'
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
      )

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('compiledNavigation function is missing from plan')
    })
  })
})

import { createJourneyRedirectTerminal } from './journeyRedirectTerminal'
import type { PipelineState } from '../types'
import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { StepResponse } from '../../../../framework/types/response.type'

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
  const response = {} as StepResponse
  const context = new RuntimeEvaluationContext(request, response)

  return { context, request }
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

import { createAccessLifecyclePhase } from './accessLifecyclePhase'
import type { PipelineState } from '../types'
import type { CompiledAccessHookResult } from '../../../contracts/runtime/hookLifecycle.type'
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
  span: vi.fn((_n: string, fn: (s: { setAttribute: () => void }) => unknown) => fn({ setAttribute: vi.fn() })),
  spanAsync: vi.fn(async (_n: string, fn: (s: { setAttribute: () => void }) => Promise<unknown>) =>
    fn({ setAttribute: vi.fn() }),
  ),
} as unknown as ForgeInstrumentation

describe('accessLifecyclePhase', () => {
  describe('execute()', () => {
    it('should return continue when access lifecycle passes', async () => {
      // Arrange
      const compiledFn = vi
        .fn()
        .mockReturnValue({ executed: true, outcome: 'continue' } satisfies CompiledAccessHookResult)
      const phase = createAccessLifecyclePhase(compiledFn, '/step', mockFunctionRegistry, mockInstrumentation)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })

    it('should return halt-redirect when access lifecycle redirects', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        outcome: 'redirect',
        redirect: '/login',
      } satisfies CompiledAccessHookResult)
      const phase = createAccessLifecyclePhase(compiledFn, '/step', mockFunctionRegistry, mockInstrumentation)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/login', reason: 'access-lifecycle' })
    })

    it('should throw when redirect target is missing', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        outcome: 'redirect',
        redirect: undefined,
      } satisfies CompiledAccessHookResult)
      const phase = createAccessLifecyclePhase(compiledFn, '/step', mockFunctionRegistry, mockInstrumentation)

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('Hook redirect target is missing')
    })

    it('should return halt-error when access lifecycle errors', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        outcome: 'error',
        status: 403,
        message: 'Forbidden',
      } satisfies CompiledAccessHookResult)
      const phase = createAccessLifecyclePhase(compiledFn, '/step', mockFunctionRegistry, mockInstrumentation)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 403, message: 'Forbidden' })
    })

    it('should default error status to 500 when not provided', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        outcome: 'error',
      } satisfies CompiledAccessHookResult)
      const phase = createAccessLifecyclePhase(compiledFn, '/step', mockFunctionRegistry, mockInstrumentation)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 500, message: 'Access denied' })
    })

    it('should throw when compiled function is missing', async () => {
      // Arrange
      const phase = createAccessLifecyclePhase(undefined, '/step', mockFunctionRegistry, mockInstrumentation)

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('compiledAccessLifecycle is missing for "/step"')
    })
  })
})

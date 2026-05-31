import { createSubmitPhase } from './submitPhase'
import type { PipelineState } from '../types'
import type { CompiledSubmitHookResult } from '../../../contracts/runtime/hookLifecycle.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
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
const mockInstrumentation = {
  span: vi.fn((_n: string, fn: (s: { setAttribute: () => void }) => unknown) => fn({ setAttribute: vi.fn() })),
  spanAsync: vi.fn(async (_n: string, fn: (s: { setAttribute: () => void }) => Promise<unknown>) =>
    fn({ setAttribute: vi.fn() }),
  ),
} as unknown as ForgeInstrumentation

describe('submitPhase', () => {
  describe('execute()', () => {
    it('should return continue and set showValidationFailures when hooks pass', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        validated: true,
        outcome: 'continue',
      } satisfies CompiledSubmitHookResult)
      const phase = createSubmitPhase(
        compiledFn,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.showValidationFailures).toBe(true)
    })

    it('should return halt-redirect when submit hooks redirect', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: '/next',
      } satisfies CompiledSubmitHookResult)
      const phase = createSubmitPhase(
        compiledFn,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/next', reason: 'submit' })
    })

    it('should return halt-error when submit hooks error', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        validated: false,
        outcome: 'error',
        status: 400,
        message: 'Bad request',
      } satisfies CompiledSubmitHookResult)
      const phase = createSubmitPhase(
        compiledFn,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 400, message: 'Bad request' })
    })

    it('should throw when redirect target is missing', async () => {
      // Arrange
      const compiledFn = vi.fn().mockReturnValue({
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: undefined,
      } satisfies CompiledSubmitHookResult)
      const phase = createSubmitPhase(
        compiledFn,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('Hook redirect target is missing')
    })

    it('should throw when compiled function is missing', async () => {
      // Arrange
      const phase = createSubmitPhase(
        undefined,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('compiledSubmitHooks is missing for step "/step"')
    })
  })
})

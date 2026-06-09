import RequestOrchestrator from './RequestOrchestrator'
import TraceRecorder from './trace/TraceRecorder'
import type { PipelineState, RequestPhase, TerminalPhase, ForgeResult, PhaseOutcome } from './types'
import type { StepRequest } from '../../../framework/types/request.type'
import { NO_OP_RESPONSE_BINDINGS } from '../../../framework/types/responseBindings.type'
import type RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'

const createMockRequest = (
  overrides: Partial<{
    params: Record<string, string>
    url: string
  }> = {},
): StepRequest => {
  const params = overrides.params ?? {}
  const url = overrides.url ?? 'http://localhost/forms/journey/step-1'
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

const createMockState = (overrides: Partial<PipelineState> = {}): PipelineState => ({
  context: {} as RuntimeEvaluationContext,
  request: createMockRequest(overrides.request ? { params: overrides.request.getParams() } : {}),
  responseBindings: NO_OP_RESPONSE_BINDINGS,
  ...overrides,
})

const createPhase = (name: string, outcome: PhaseOutcome): RequestPhase => ({
  name,
  execute: vi.fn().mockResolvedValue(outcome),
})

const createTerminal = (name: string, result: ForgeResult): TerminalPhase => ({
  name,
  execute: vi.fn().mockResolvedValue(result),
})

describe('RequestOrchestrator', () => {
  describe('execute()', () => {
    it('should run all phases then the terminal when all phases continue', async () => {
      // Arrange
      const phase1 = createPhase('phase-1', { action: 'continue' })
      const phase2 = createPhase('phase-2', { action: 'continue' })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1, phase2], terminal)
      const state = createMockState()

      // Act
      const result = await orchestrator.execute(state)

      // Assert
      expect(phase1.execute).toHaveBeenCalledWith(state)
      expect(phase2.execute).toHaveBeenCalledWith(state)
      expect(terminal.execute).toHaveBeenCalledWith(state)
      expect(result.type).toBe('render')
    })

    it('should halt and redirect when a phase returns halt-redirect', async () => {
      // Arrange
      const phase1 = createPhase('phase-1', { action: 'halt-redirect', target: '/other-step', reason: 'unreachable' })
      const phase2 = createPhase('phase-2', { action: 'continue' })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1, phase2], terminal)
      const state = createMockState()

      // Act
      const result = await orchestrator.execute(state)

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/other-step' })
      expect(phase2.execute).not.toHaveBeenCalled()
      expect(terminal.execute).not.toHaveBeenCalled()
    })

    it('should resolve path params in redirect targets', async () => {
      // Arrange
      const phase1 = createPhase('phase-1', {
        action: 'halt-redirect',
        target: '/journey/:personId/next-step',
        reason: 'unreachable',
      })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1], terminal)
      const state = createMockState({
        request: createMockRequest({ params: { personId: '123' } }),
      })

      // Act
      const result = await orchestrator.execute(state)

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/journey/123/next-step' })
    })

    it('should throw an HTTP error when a phase returns halt-error', async () => {
      // Arrange
      const phase1 = createPhase('phase-1', { action: 'halt-error', status: 403, message: 'Forbidden' })
      const phase2 = createPhase('phase-2', { action: 'continue' })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1, phase2], terminal)
      const state = createMockState()

      // Act & Assert
      await expect(orchestrator.execute(state)).rejects.toThrow(
        expect.objectContaining({ statusCode: 403, message: 'Forbidden' }),
      )
      expect(phase2.execute).not.toHaveBeenCalled()
      expect(terminal.execute).not.toHaveBeenCalled()
    })

    it('should go straight to terminal when there are no phases', async () => {
      // Arrange
      const terminal = createTerminal('render', { type: 'redirect', url: '/somewhere' })
      const orchestrator = new RequestOrchestrator([], terminal)
      const state = createMockState()

      // Act
      const result = await orchestrator.execute(state)

      // Assert
      expect(terminal.execute).toHaveBeenCalledWith(state)
      expect(result).toEqual({ type: 'redirect', url: '/somewhere' })
    })

    it('should record each phase and the terminal into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const phase1 = createPhase('access', { action: 'continue' })
      const phase2 = createPhase('validation', { action: 'continue' })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1, phase2], terminal)

      // Act
      await orchestrator.execute(createMockState({ trace: recorder }))

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases.map(phase => [phase.phase, phase.outcome])).toEqual([
        ['access', 'continue'],
        ['validation', 'continue'],
        ['render', 'render'],
      ])
    })

    it('should record the halting outcome when a phase halts with a redirect', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const phase1 = createPhase('navigation', { action: 'halt-redirect', target: '/elsewhere', reason: 'unreachable' })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1], terminal)

      // Act
      await orchestrator.execute(createMockState({ trace: recorder }))

      // Assert
      const trace = recorder.finish('redirect')

      expect(trace.phases).toEqual([expect.objectContaining({ phase: 'navigation', outcome: 'halt-redirect' })])
    })

    it('should record the halting outcome before throwing when a phase halts with an error', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const phase1 = createPhase('access', { action: 'halt-error', status: 403, message: 'Forbidden' })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1], terminal)

      // Act & Assert
      await expect(orchestrator.execute(createMockState({ trace: recorder }))).rejects.toThrow('Forbidden')

      const trace = recorder.finish('error')

      expect(trace.phases).toEqual([expect.objectContaining({ phase: 'access', outcome: 'halt-error' })])
    })

    it('should stop at the first halting phase in a chain', async () => {
      // Arrange
      const phase1 = createPhase('phase-1', { action: 'continue' })
      const phase2 = createPhase('phase-2', { action: 'halt-redirect', target: '/stop-here', reason: 'unreachable' })
      const phase3 = createPhase('phase-3', { action: 'continue' })
      const terminal = createTerminal('render', { type: 'render', context: {} } as ForgeResult)
      const orchestrator = new RequestOrchestrator([phase1, phase2, phase3], terminal)
      const state = createMockState()

      // Act
      await orchestrator.execute(state)

      // Assert
      expect(phase1.execute).toHaveBeenCalled()
      expect(phase2.execute).toHaveBeenCalled()
      expect(phase3.execute).not.toHaveBeenCalled()
      expect(terminal.execute).not.toHaveBeenCalled()
    })
  })
})

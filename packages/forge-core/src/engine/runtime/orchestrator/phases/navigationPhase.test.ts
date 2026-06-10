import { createNavigationPhase } from './navigationPhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { PipelineState } from '../types'
import type { NavigationEvaluation, NavigationStepState } from '../../../contracts/navigation/navigationEvaluation.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
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

const createMockStepState = (stepId: NodeId, isReachable: boolean, isValid: boolean): NavigationStepState => ({
  stepId,
  routeTemplatePath: '/journey/step',
  declarationIndex: 0,
  isEntryPoint: false,
  isConditionalEntry: false,
  hasValidation: false,
  isReachable,
  isValid,
  forwardRouteTemplatePaths: [],
  predecessorRouteTemplatePaths: [],
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

    it('should record navigation-step and navigation-resolution units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const evaluation = {
        ...createMockEvaluation(),
        steps: [
          createMockStepState('compile_ast:1' as const, true, true),
          createMockStepState('compile_ast:2' as const, false, false),
        ],
      }
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

      recorder.beginPhase('navigation')

      // Act
      await phase.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        { kind: 'navigation-step', nodeId: 'compile_ast:1', isReachable: true, isValid: true },
        { kind: 'navigation-step', nodeId: 'compile_ast:2', isReachable: false, isValid: false },
        expect.objectContaining({ kind: 'navigation-resolution', resumeOutcome: 'no-op', redirect: undefined }),
      ])
    })

    it('should record the resolved redirect target on the navigation-resolution unit when redirecting', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const evaluation = { ...createMockEvaluation(), resumeOutcome: 'redirect' as const }
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

      recorder.beginPhase('navigation')

      // Act
      const result = await phase.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('halt-redirect')

      // Assert
      const trace = recorder.finish('redirect')

      expect(result).toEqual({ action: 'halt-redirect', target: '/other-step', reason: 'resume' })
      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'navigation-resolution', resumeOutcome: 'redirect', redirect: '/other-step' }),
      ])
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

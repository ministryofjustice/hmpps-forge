import { createAnswerPreparationPlanPhase } from './answerPreparationPhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { PipelineState } from '../types'
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

describe('answerPreparationPhase', () => {
  describe('execute()', () => {
    it('should call field preparation functions and return continue', async () => {
      // Arrange
      const prepareFn = vi.fn()
      const plan: AnswerPreparationPlan = {
        fields: [{ nodeId: 'compile_ast:1' as const, prepare: prepareFn }],
        iteratorGroups: [],
      }
      const phase = createAnswerPreparationPlanPhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(prepareFn).toHaveBeenCalled()
      expect(result).toEqual({ action: 'continue' })
    })

    it('should await async field preparation', async () => {
      // Arrange
      let prepared = false
      const prepareFn = vi.fn().mockImplementation(async () => {
        await Promise.resolve()
        prepared = true
      })
      const plan: AnswerPreparationPlan = {
        fields: [{ nodeId: 'compile_ast:1' as const, prepare: prepareFn }],
        iteratorGroups: [],
      }
      const phase = createAnswerPreparationPlanPhase(plan, mockFunctionRegistry)

      // Act
      await phase.execute(createMockState())

      // Assert
      expect(prepared).toBe(true)
    })

    it('should record answer-preparation units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan: AnswerPreparationPlan = {
        fields: [{ nodeId: 'compile_ast:1' as const, prepare: vi.fn() }],
        iteratorGroups: [],
      }
      const phase = createAnswerPreparationPlanPhase(plan, mockFunctionRegistry)

      recorder.beginPhase('prepare-answers')

      // Act
      await phase.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'answer-preparation', nodeId: 'compile_ast:1' }),
      ])
    })

    it('should no-op when plan has no fields', async () => {
      // Arrange
      const plan: AnswerPreparationPlan = { fields: [], iteratorGroups: [] }
      const phase = createAnswerPreparationPlanPhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })
  })
})

import { createAnswerPreparationPhase } from './answerPreparationPhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

const mockFunctionRegistry = {} as FunctionRegistry

describe('answerPreparationPhase', () => {
  describe('execute()', () => {
    it('should call field preparation functions and return continue', async () => {
      // Arrange
      const prepareFn = vi.fn()
      const plan: AnswerPreparationPlan = {
        fieldAnswerPreparations: [{ nodeId: 'compile_ast:1' as const, prepare: prepareFn }],
        iteratorAnswerPreparationGroups: [],
      }
      const phase = createAnswerPreparationPhase(plan, mockFunctionRegistry)

      // Act
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(prepareFn).toHaveBeenCalled()
      expect(result).toEqual({ action: 'continue' })
      expect(state.navigationEvaluation).toBeUndefined()
      expect(state.validation).toBeUndefined()
      expect(state.showValidationFailures).toBeUndefined()
      expect(state.context.global.validation).toBeUndefined()
      expect(state.context.global.reachability).toBeUndefined()
    })

    it('should await async field preparation', async () => {
      // Arrange
      let prepared = false
      const prepareFn = vi.fn().mockImplementation(async () => {
        await Promise.resolve()
        prepared = true
      })
      const plan: AnswerPreparationPlan = {
        fieldAnswerPreparations: [{ nodeId: 'compile_ast:1' as const, prepare: prepareFn }],
        iteratorAnswerPreparationGroups: [],
      }
      const phase = createAnswerPreparationPhase(plan, mockFunctionRegistry)

      // Act
      await phase.execute(createPipelineState())

      // Assert
      expect(prepared).toBe(true)
    })

    it('should record answer-preparation units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan: AnswerPreparationPlan = {
        fieldAnswerPreparations: [{ nodeId: 'compile_ast:1' as const, prepare: vi.fn() }],
        iteratorAnswerPreparationGroups: [],
      }
      const phase = createAnswerPreparationPhase(plan, mockFunctionRegistry)

      recorder.beginPhase('answer-preparation')

      // Act
      await phase.execute({ ...createPipelineState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'answer-preparation-field', nodeId: 'compile_ast:1' }),
      ])
    })

    it('should no-op when plan has no fields', async () => {
      // Arrange
      const plan: AnswerPreparationPlan = { fieldAnswerPreparations: [], iteratorAnswerPreparationGroups: [] }
      const phase = createAnswerPreparationPhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })
  })
})

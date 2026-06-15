import { createAnswerPreparationPhase } from './answerPreparationPhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type {
  CompiledTemplateMaterialisationRoot,
  MaterialisedTemplateNode,
} from '../../../contracts/plans/materialisationArtefacts.type'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

const mockFunctionRegistry = {} as FunctionRegistry

describe('answerPreparationPhase', () => {
  describe('execute()', () => {
    it('should call field preparation functions and return continue', async () => {
      // Arrange
      const prepareFn = vi.fn()
      const plan: AnswerPreparationPlan = {
        items: [{ kind: 'field', entry: { nodeId: 'compile_ast:1' as const, prepare: prepareFn } }],
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
        items: [{ kind: 'field', entry: { nodeId: 'compile_ast:1' as const, prepare: prepareFn } }],
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
        items: [{ kind: 'field', entry: { nodeId: 'compile_ast:1' as const, prepare: vi.fn() } }],
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

    it('should store materialisation produced during ordered answer preparation', async () => {
      // Arrange
      const order: string[] = []
      const prepareFn = vi.fn(_ctx => {
        order.push('materialised:0')
      })
      const node: MaterialisedTemplateNode = {
        sourceNodeId: 'template:1' as const,
        instanceKey: 'compile_ast:2[0]/template:1',
        origin: {
          iteratorNodeId: 'compile_ast:2' as const,
          itemIndex: 0,
        },
        prepare: prepareFn,
      }
      const root: CompiledTemplateMaterialisationRoot = {
        nodeId: 'compile_ast:2' as const,
        templateFunctions: new Map(),
        materialise: vi.fn(ctx => {
          order.push(`materialise:${ctx.answers.seed?.current}`)

          return [node]
        }),
      }
      const plan: AnswerPreparationPlan = {
        items: [
          {
            kind: 'field',
            entry: {
              nodeId: 'compile_ast:1' as const,
              prepare: vi.fn(ctx => {
                order.push('field')
                ctx.answers.seed = { current: 'ready', mutations: [{ value: 'ready', source: 'default' }] }
              }),
            },
          },
          { kind: 'materialisation-root', root },
        ],
      }
      const phase = createAnswerPreparationPhase(plan, mockFunctionRegistry)
      const state = createPipelineState()

      // Act
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(order).toEqual(['field', 'materialise:ready', 'materialised:0'])
      expect(state.materialisation).toEqual([node])
    })

    it('should no-op when plan has no fields', async () => {
      // Arrange
      const plan: AnswerPreparationPlan = {
        items: [],
      }
      const phase = createAnswerPreparationPhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })
  })
})

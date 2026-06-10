import { evaluateAnswerPreparation } from './evaluateAnswerPreparation'
import TraceRecorder from '../trace/TraceRecorder'
import type { AnswerPreparationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'

const mockCtx = {} as AnswerPreparationContext

const runTraced = async (plan: AnswerPreparationPlan) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('answer-preparation')
  await evaluateAnswerPreparation(plan, mockCtx, recorder)
  recorder.endPhase('continue')

  return recorder.finish('render').phases[0].units
}

describe('evaluateAnswerPreparation', () => {
  describe('sequential execution', () => {
    it('should await each field preparation before starting the next when an earlier one is async', async () => {
      // Arrange
      const order: string[] = []
      const first = vi.fn().mockImplementation(async () => {
        order.push('first:start')
        await new Promise(resolve => {
          setTimeout(resolve, 1)
        })
        order.push('first:end')
      })
      const second = vi.fn().mockImplementation(() => {
        order.push('second:start')
      })
      const plan: AnswerPreparationPlan = {
        fields: [
          { nodeId: 'compile_ast:2' as const, prepare: first },
          { nodeId: 'compile_ast:3' as const, prepare: second },
        ],
        iteratorGroups: [],
      }

      // Act
      await evaluateAnswerPreparation(plan, mockCtx)

      // Assert
      expect(order).toEqual(['first:start', 'first:end', 'second:start'])
    })

    it('should prepare iterator items one at a time in item order', async () => {
      // Arrange
      const order: string[] = []
      const itemScopes = [
        { item: { value: 'a' }, index: 0, rawItem: 'a', inputLength: 2 },
        { item: { value: 'b' }, index: 1, rawItem: 'b', inputLength: 2 },
      ]
      const prepare = vi.fn().mockImplementation(async (_ctx, itemScope) => {
        order.push(`item-${itemScope.index}:start`)
        await new Promise(resolve => {
          setTimeout(resolve, 1)
        })
        order.push(`item-${itemScope.index}:end`)
      })
      const plan: AnswerPreparationPlan = {
        fields: [],
        iteratorGroups: [
          {
            nodeId: 'compile_ast:5' as const,
            evaluateInput: vi.fn().mockResolvedValue(itemScopes),
            fields: [{ nodeId: 'template:1' as const, prepare }],
          },
        ],
      }

      // Act
      await evaluateAnswerPreparation(plan, mockCtx)

      // Assert
      expect(order).toEqual(['item-0:start', 'item-0:end', 'item-1:start', 'item-1:end'])
    })
  })

  describe('tracing', () => {
    it('should record one decision per field preparation when tracing', async () => {
      // Arrange
      const plan: AnswerPreparationPlan = {
        fields: [
          { nodeId: 'compile_ast:2' as const, prepare: vi.fn() },
          { nodeId: 'compile_ast:3' as const, prepare: vi.fn() },
        ],
        iteratorGroups: [],
      }

      // Act
      const units = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({ kind: 'answer-preparation', nodeId: 'compile_ast:2' }),
        expect.objectContaining({ kind: 'answer-preparation', nodeId: 'compile_ast:3' }),
      ])
    })

    it('should record the iterator expansion and one decision per field per item when tracing', async () => {
      // Arrange
      const itemScopes = [
        { item: { value: 'a' }, index: 0, rawItem: 'a', inputLength: 2 },
        { item: { value: 'b' }, index: 1, rawItem: 'b', inputLength: 2 },
      ]
      const plan: AnswerPreparationPlan = {
        fields: [],
        iteratorGroups: [
          {
            nodeId: 'compile_ast:5' as const,
            evaluateInput: vi.fn().mockResolvedValue(itemScopes),
            fields: [{ nodeId: 'template:1' as const, prepare: vi.fn() }],
          },
        ],
      }

      // Act
      const units = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({ kind: 'iterator-input', nodeId: 'compile_ast:5', itemCount: 2 }),
        expect.objectContaining({ kind: 'answer-preparation', nodeId: 'template:1', itemIndex: 0 }),
        expect.objectContaining({ kind: 'answer-preparation', nodeId: 'template:1', itemIndex: 1 }),
      ])
    })

    it('should record nothing and still prepare when no recorder is supplied', async () => {
      // Arrange
      const prepare = vi.fn()
      const plan: AnswerPreparationPlan = {
        fields: [{ nodeId: 'compile_ast:2' as const, prepare }],
        iteratorGroups: [],
      }

      // Act
      await evaluateAnswerPreparation(plan, mockCtx)

      // Assert
      expect(prepare).toHaveBeenCalledTimes(1)
    })
  })
})

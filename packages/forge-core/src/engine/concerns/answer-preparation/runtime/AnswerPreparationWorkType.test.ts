import { describe, expect, it, vi } from 'vitest'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import { createWorkTask } from '../../../runtime/evaluation/work/workTask'
import WorkContext from '../../../runtime/evaluation/work/WorkContext'
import WorkExecutor from '../../../runtime/evaluation/work/WorkExecutor'
import {
  ANSWER_PREPARATION_KIND,
  ANSWER_PREPARATION_WORK_HANDLER,
  ANSWER_PREPARATION_WORK_INSTRUMENTATION,
} from './AnswerPreparationWorkHandler'
import {
  FIELD_ANSWER_PREPARATION_KIND,
  FIELD_ANSWER_PREPARATION_WORK_HANDLER,
  FIELD_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
} from './FieldAnswerPreparationWorkHandler'

// The handler runs under the threaded RequestExecutionContext; only its instrumentation
// reads `ctx.request.context.answers`, so the stub provides just that.
function createContext(): WorkContext<RequestExecutionContext> {
  return new WorkContext({
    context: { domain: { answers: {}, data: {} }, evaluation: {}, request: {} },
  } as unknown as RequestExecutionContext)
}

describe('AnswerPreparationWorkHandler', () => {
  describe('begin()', () => {
    it('should run field preparation tasks sequentially in authored order', async () => {
      // Arrange
      const calls: string[] = []
      const first = createWorkTask('field:first', FIELD_ANSWER_PREPARATION_WORK_HANDLER, {
        code: 'first',
        mode: 'POST',
        run: () => {
          calls.push('first')

          return { code: 'first', mode: 'POST', current: 'Ada', mutations: [{ value: 'Ada', source: 'post' }] }
        },
      })
      const second = createWorkTask('field:second', FIELD_ANSWER_PREPARATION_WORK_HANDLER, {
        code: 'second',
        mode: 'POST',
        run: () => {
          calls.push('second')

          return {
            code: 'second',
            mode: 'POST',
            current: 'Lovelace',
            mutations: [{ value: 'Lovelace', source: 'post' }],
          }
        },
      })
      const task = createWorkTask('answer-preparation', ANSWER_PREPARATION_WORK_HANDLER, {
        fields: [first, second],
      })

      // Act
      const result = await new WorkExecutor().execute(task, createContext())

      // Assert
      expect(calls).toEqual(['first', 'second'])
      expect(result.output.fields.map(field => field.code)).toEqual(['first', 'second'])
    })

    it('should emit executor-owned trace fields for answer preparation', async () => {
      // Arrange
      const context = createContext()
      const field = createWorkTask(
        'field:name',
        FIELD_ANSWER_PREPARATION_WORK_HANDLER,
        {
          code: 'name',
          mode: 'GET',
          run: () => {
            context.request.context.domain.answers.name = {
              current: 'Ada',
              mutations: [{ value: 'Ada', source: 'default' }],
            }

            return { code: 'name', mode: 'GET', current: 'Ada', mutations: [{ value: 'Ada', source: 'default' }] }
          },
        },
        FIELD_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
      )
      const task = createWorkTask(
        'answer-preparation',
        ANSWER_PREPARATION_WORK_HANDLER,
        { fields: [field] },
        ANSWER_PREPARATION_WORK_INSTRUMENTATION,
      )

      // Act
      const result = await new WorkExecutor().executeWithUnit(task, context)

      // Assert
      expect(result.traceSpan.kind).toBe(ANSWER_PREPARATION_KIND)
      expect(result.traceSpan.completeFields.answers).toEqual(context.request.context.domain.answers)
      expect(result.traceSpan.children[0].kind).toBe(FIELD_ANSWER_PREPARATION_KIND)
      expect(result.traceSpan.children[0].beginFields).toEqual({ code: 'name', mode: 'GET' })
      expect(result.traceSpan.children[0].completeFields).toEqual({
        code: 'name',
        mode: 'GET',
        mutationCount: 1,
        parsed: false,
      })
    })

    it('should propagate field preparation errors without completing the failed unit', async () => {
      // Arrange
      const field = createWorkTask('field:name', FIELD_ANSWER_PREPARATION_WORK_HANDLER, {
        code: 'name',
        mode: 'POST',
        run: vi.fn(() => {
          throw new Error('prepare failed')
        }),
      })
      const task = createWorkTask('answer-preparation', ANSWER_PREPARATION_WORK_HANDLER, { fields: [field] })

      // Act & Assert
      await expect(new WorkExecutor().execute(task, createContext())).rejects.toThrow('prepare failed')
    })
  })
})

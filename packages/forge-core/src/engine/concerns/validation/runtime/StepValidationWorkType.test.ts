import { describe, expect, it, vi } from 'vitest'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import type { CompiledValidationContext } from '../../../chassis/contracts/compiled/compiledContexts.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import { STEP_VALIDATION_WORK_HANDLER, STEP_VALIDATION_WORK_INSTRUMENTATION } from './StepValidationWorkHandler'
import { FIELD_VALIDATION_WORK_HANDLER, FIELD_VALIDATION_WORK_INSTRUMENTATION } from './FieldValidationWorkHandler'
import { DOMAIN_VALIDATION_WORK_HANDLER, DOMAIN_VALIDATION_WORK_INSTRUMENTATION } from './DomainValidationWorkHandler'

function createContext(): WorkContext<CompiledValidationContext> {
  return new WorkContext({
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: {},
    conditions: { get: vi.fn() } as unknown as CompiledValidationContext['conditions'],
    workTasks: {},
  })
}

describe('StepValidationWorkHandler', () => {
  describe('execute()', () => {
    it('should fold field and domain validation failures in child order', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const validation = createWorkTask('validation-step', STEP_VALIDATION_WORK_HANDLER, {
        fields: [
          createWorkTask('field:first', FIELD_VALIDATION_WORK_HANDLER, {
            blockId: 'compile_ast:1',
            blockCode: 'first',
            run: async () => [
              {
                blockId: 'compile_ast:1',
                blockCode: 'first',
                passed: false,
                message: 'First is required',
                submissionOnly: false,
                groups: ['default'],
              },
            ],
          }),
          createWorkTask('field:second', FIELD_VALIDATION_WORK_HANDLER, {
            blockId: 'compile_ast:2',
            blockCode: 'second',
            run: () => [
              {
                blockId: 'compile_ast:2',
                blockCode: 'second',
                passed: false,
                message: 'Second is required',
                submissionOnly: false,
                groups: ['default'],
              },
            ],
          }),
        ],
        domains: [
          createWorkTask('domain:0', DOMAIN_VALIDATION_WORK_HANDLER, {
            run: async () => {
              await new Promise(resolve => {
                setTimeout(resolve, 10)
              })

              return [{ passed: false, message: 'First domain failed', submissionOnly: false, groups: ['default'] }]
            },
          }),
          createWorkTask('domain:1', DOMAIN_VALIDATION_WORK_HANDLER, {
            run: () => [{ passed: false, message: 'Second domain failed', submissionOnly: false, groups: ['default'] }],
          }),
        ],
      })

      // Act
      const result = await executor.execute(validation, createContext())

      // Assert
      expect(result.output).toMatchObject({
        fieldFailures: [{ message: 'First is required' }, { message: 'Second is required' }],
        domainFailures: [{ message: 'First domain failed' }, { message: 'Second domain failed' }],
      })
    })

    it('should attach executor-owned trace fields and child work units', async () => {
      // Arrange
      const executor = new WorkExecutor()
      const validation = createWorkTask(
        'validation-step',
        STEP_VALIDATION_WORK_HANDLER,
        {
          fields: [
            createWorkTask(
              'field:first',
              FIELD_VALIDATION_WORK_HANDLER,
              {
                blockId: 'compile_ast:1',
                blockCode: 'first',
                run: () => [
                  {
                    blockId: 'compile_ast:1',
                    blockCode: 'first',
                    passed: false,
                    message: 'First is required',
                    submissionOnly: false,
                    groups: ['default'],
                  },
                ],
              },
              FIELD_VALIDATION_WORK_INSTRUMENTATION,
            ),
          ],
          domains: [
            createWorkTask(
              'domain:0',
              DOMAIN_VALIDATION_WORK_HANDLER,
              {
                run: () => [{ passed: false, message: 'Domain failed', submissionOnly: false, groups: ['default'] }],
              },
              DOMAIN_VALIDATION_WORK_INSTRUMENTATION,
            ),
          ],
        },
        STEP_VALIDATION_WORK_INSTRUMENTATION,
      )

      // Act
      const result = await executor.executeWithUnit(validation, createContext())

      // Assert
      expect(result.traceSpan.beginFields).toEqual({ fieldValidations: 1, domainValidations: 1 })
      expect(result.traceSpan.completeFields).toEqual({ fieldFailures: 1, domainFailures: 1 })
      expect(result.traceSpan.children).toEqual([
        expect.objectContaining({
          key: 'field:first',
          kind: 'validation.field',
          beginFields: { blockId: 'compile_ast:1', blockCode: 'first' },
          completeFields: { failures: 1 },
        }),
        expect.objectContaining({
          key: 'domain:0',
          kind: 'validation.domain',
          completeFields: { failures: 1 },
        }),
      ])
    })
  })
})

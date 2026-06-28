import { describe, expect, it, vi } from 'vitest'
import type { NodeId } from '../../../../contracts/ast/ast.type'
import type { StepValidityResult } from '../../../../contracts/runtime/stepValidityResult.type'
import WorkContext from '../../work/WorkContext'
import WorkExecutor from '../../work/WorkExecutor'
import type { WorkHandler } from '../../../../contracts/runtime/work.type'
import { createWorkTask } from '../../work/workTask'
import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { StepValidationWorkProps } from '../../../../contracts/runtime/ValidationWork.type'
import { SUBMIT_VALIDATION_WORK_HANDLER } from './SubmitValidationWorkHandler'

function createContext(overrides: Partial<RequestExecutionContext> = {}): WorkContext<RequestExecutionContext> {
  const compiled = {
    currentStepId: 'step-1' as NodeId,
    snapshots: { capture: vi.fn(), snapshotFor: vi.fn() },
    answers: {},
    context: { evaluation: { stepValidities: new Map() }, domain: { data: {}, answers: {} }, request: {} },
    ...overrides,
  } as unknown as RequestExecutionContext

  return new WorkContext(compiled)
}

function stubValidation(result: StepValidityResult) {
  const workHandler: WorkHandler<'validation.step', StepValidationWorkProps> = {
    kind: 'validation.step',
    begin: () => ({ output: result }),
  }

  return createWorkTask('validation:stub', workHandler, { fields: [], domains: [] })
}

describe('SubmitValidationWorkHandler', () => {
  describe('execute()', () => {
    it('should run the built validation child and reduce its result', async () => {
      // Arrange
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const buildStepValidation = vi.fn(() => stubValidation(result))
      const recordStepValidation = vi.fn()
      const validation = createWorkTask('submit-validation', SUBMIT_VALIDATION_WORK_HANDLER, { groups: ['lookup'] })

      // Act
      const completed = await new WorkExecutor().execute(
        validation,
        createContext({ buildStepValidation, recordStepValidation }),
      )

      // Assert
      expect(buildStepValidation).toHaveBeenCalledWith('step-1', true)
      expect(recordStepValidation).toHaveBeenCalledWith('step-1', result)
      expect(completed.output).toEqual({ status: 'continue' })
      expect(completed.children.map(child => child.key)).toEqual(['validation:stub'])
    })

    it('should reject when validation task is missing', async () => {
      // Arrange
      const buildStepValidation = vi.fn(() => undefined)
      const validation = createWorkTask('submit-validation', SUBMIT_VALIDATION_WORK_HANDLER, { groups: ['lookup'] })

      // Act & Assert
      await expect(new WorkExecutor().execute(validation, createContext({ buildStepValidation }))).rejects.toThrow(
        'Compiled validation missing for submit',
      )
    })
  })
})

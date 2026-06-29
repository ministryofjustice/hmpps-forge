import { describe, expect, it, vi } from 'vitest'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { CompiledValidationFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'
import type { StepValidationWorkProps } from '../../../contracts/runtime/ValidationWork.type'
import type { WorkHandler } from '../../../contracts/runtime/work.type'
import { createWorkTask } from '../work/workTask'
import WorkContext from '../work/WorkContext'
import WorkExecutor from '../work/WorkExecutor'
import WorkTaskFactory from '../work/WorkTaskFactory'
import { validationTaskKey } from '../phases/validation/stepValidationStore'

function createRequestContext(overrides: Partial<RequestExecutionContext> = {}): WorkContext<RequestExecutionContext> {
  const request: RequestExecutionContext = {
    context: { evaluation: {}, domain: { data: {}, answers: {} }, request: {} },
    responseBindings: {},
    functionRegistry: {} as RequestExecutionContext['functionRegistry'],
    hasRenderer: false,
    buildStepValidation: () => undefined,
    recordStepValidation: () => {},
    ...overrides,
  } as RequestExecutionContext

  return new WorkContext(request)
}

function stubValidation(stepId: NodeId, result: StepValidityResult) {
  const workHandler: WorkHandler<'validation.step', StepValidationWorkProps> = {
    kind: 'validation.step',
    begin: () => ({ output: result }),
  }

  return createWorkTask(validationTaskKey(stepId), workHandler, { fields: [], domains: [] })
}

describe('RequestValiditiesWorkHandler', () => {
  describe('execute()', () => {
    it('should run and record only steps in the journey validation map', async () => {
      // Arrange
      const validatingStepId = 'validating-step' as NodeId
      const nonValidatingStepId = 'non-validating-step' as NodeId
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const buildStepValidation = vi.fn((stepId: NodeId) => stubValidation(stepId, result))
      const recordStepValidation = vi.fn()
      const compiledValidation = vi.fn() as unknown as CompiledValidationFunction
      const validities = WorkTaskFactory.requestValidities({
        compiledStepValidations: new Map([[validatingStepId, compiledValidation]]),
      })

      // Act
      const completed = await new WorkExecutor().execute(
        validities,
        createRequestContext({ buildStepValidation, recordStepValidation }),
      )

      // Assert
      expect(completed.output).toEqual({ action: 'continue' })
      expect(buildStepValidation).toHaveBeenCalledWith(validatingStepId, false)
      expect(buildStepValidation).not.toHaveBeenCalledWith(nonValidatingStepId, false)
      expect(recordStepValidation).toHaveBeenCalledWith(validatingStepId, result)
      expect(recordStepValidation).not.toHaveBeenCalledWith(nonValidatingStepId, result)
    })
  })
})

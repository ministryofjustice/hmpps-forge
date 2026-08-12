import { describe, expect, it, vi } from 'vitest'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { CompiledValidationFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type { StepValidationWorkProps } from '../contracts/ValidationWork.type'
import type { WorkHandler } from '../../../contracts/runtime/work.type'
import { createWorkTask } from '../../../runtime/evaluation/work/workTask'
import WorkContext from '../../../runtime/evaluation/work/WorkContext'
import WorkExecutor from '../../../runtime/evaluation/work/WorkExecutor'
import WorkTaskFactory from '../../../runtime/evaluation/work/WorkTaskFactory'
import { validationTaskKey } from './stepValidationStore'

function createRequestContext(overrides: Partial<RequestExecutionContext> = {}): WorkContext<RequestExecutionContext> {
  const request: RequestExecutionContext = {
    context: { evaluation: {}, domain: { data: {}, answers: {} }, request: {} },
    responseBindings: {},
    functionRegistry: {} as RequestExecutionContext['functionRegistry'],
    hasRenderer: false,
    traceEnabled: false,
    buildStepValidation: () => undefined,
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

describe('ReachabilityValiditiesWorkHandler', () => {
  describe('execute()', () => {
    it('should run and record only steps in the journey validation map', async () => {
      // Arrange
      const validatingStepId = 'validating-step' as NodeId
      const nonValidatingStepId = 'non-validating-step' as NodeId
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const buildStepValidation = vi.fn((stepId: NodeId) => stubValidation(stepId, result))
      const compiledValidation = vi.fn() as unknown as CompiledValidationFunction
      const context = createRequestContext({ buildStepValidation })
      const validities = WorkTaskFactory.requestValidities({
        compiledStepValidations: new Map([[validatingStepId, compiledValidation]]),
      })

      // Act
      const completed = await new WorkExecutor().execute(validities, context)

      // Assert
      expect(completed.output).toEqual({ action: 'continue' })
      expect(buildStepValidation).toHaveBeenCalledWith(validatingStepId, {
        groups: ['default'],
        includeSubmissionOnly: false,
      })
      expect(buildStepValidation).toHaveBeenCalledTimes(1)
      expect(context.request.context.evaluation.reachabilityValidities?.get(validatingStepId)).toEqual(result)
      expect(context.request.context.evaluation.reachabilityValidities?.has(nonValidatingStepId)).toBe(false)
    })

    it('should record navigation facts without touching current-page validation', async () => {
      // Arrange
      const currentStepId = 'current-step' as NodeId
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const buildStepValidation = vi.fn((stepId: NodeId) => stubValidation(stepId, result))
      const compiledValidation = vi.fn() as unknown as CompiledValidationFunction
      const context = createRequestContext({ buildStepValidation, currentStepId })
      const validities = WorkTaskFactory.requestValidities({
        compiledStepValidations: new Map([[currentStepId, compiledValidation]]),
      })

      // Act
      const completed = await new WorkExecutor().execute(validities, context)

      // Assert
      expect(completed.output).toEqual({ action: 'continue' })
      expect(context.request.context.evaluation.reachabilityValidities?.get(currentStepId)).toEqual(result)
      expect(context.request.currentPageValidation).toBeUndefined()
    })
  })
})

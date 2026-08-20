import { describe, expect, it, vi } from 'vitest'
import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { CompiledValidationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { RequestDependencies } from '../../../chassis/runtime/pipeline/RequestState'
import type { RuntimeContext } from '../../../chassis/contracts/runtime/evaluationState.type'
import { createTestRequestState } from '../../../chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type { StepValidationWorkProps } from '../contracts/ValidationWork.type'
import type { WorkHandler } from '../../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { createReachabilityValiditiesTask } from './ReachabilityValiditiesWorkHandler'
import { validationTaskKey } from './stepValidationStore'

function createRequestContext(overrides: Partial<RequestDependencies> = {}): WorkContext<RequestState> {
  const context = { evaluation: {}, domain: { data: {}, answers: {} }, request: {} } as RuntimeContext

  return new WorkContext(createTestRequestState(context, overrides))
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
      const validities = createReachabilityValiditiesTask({
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
      expect(context.state.context.evaluation.reachabilityValidities?.get(validatingStepId)).toEqual(result)
      expect(context.state.context.evaluation.reachabilityValidities?.has(nonValidatingStepId)).toBe(false)
    })

    it('should record navigation facts without touching current-page validation', async () => {
      // Arrange
      const currentStepId = 'current-step' as NodeId
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const buildStepValidation = vi.fn((stepId: NodeId) => stubValidation(stepId, result))
      const compiledValidation = vi.fn() as unknown as CompiledValidationFunction
      const context = createRequestContext({ buildStepValidation, currentStepId })
      const validities = createReachabilityValiditiesTask({
        compiledStepValidations: new Map([[currentStepId, compiledValidation]]),
      })

      // Act
      const completed = await new WorkExecutor().execute(validities, context)

      // Assert
      expect(completed.output).toEqual({ action: 'continue' })
      expect(context.state.context.evaluation.reachabilityValidities?.get(currentStepId)).toEqual(result)
      expect(context.state.currentPageValidation).toBeUndefined()
    })
  })
})

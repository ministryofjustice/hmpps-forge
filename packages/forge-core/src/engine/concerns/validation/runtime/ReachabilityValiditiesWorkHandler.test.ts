import { describe, expect, it, vi } from 'vitest'
import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { CompiledValidationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { RequestDependencies } from '../../../chassis/runtime/pipeline/RequestState'
import type { RuntimeContext } from '../../../chassis/contracts/runtime/evaluationState.type'
import { createTestRequestState } from '../../../chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { createReachabilityValiditiesTask } from './ReachabilityValiditiesWorkHandler'
import { createStepValidationTask } from './StepValidationWorkHandler'

function createRequestContext(overrides: Partial<RequestDependencies> = {}): WorkContext<RequestState> {
  const context = { evaluation: {}, domain: { data: {}, answers: {} }, request: {} } as RuntimeContext

  return new WorkContext(createTestRequestState(context, overrides))
}

describe('ReachabilityValiditiesWorkHandler', () => {
  describe('execute()', () => {
    it('should run and record only steps in the journey validation map', async () => {
      // Arrange
      const validatingStepId = 'validating-step' as NodeId
      const nonValidatingStepId = 'non-validating-step' as NodeId
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const compiledValidation: CompiledValidationFunction = vi.fn(() => createStepValidationTask([], []))
      const context = createRequestContext()
      const validities = createReachabilityValiditiesTask({
        compiledStepValidations: new Map([[validatingStepId, compiledValidation]]),
      })

      // Act
      const completed = await new WorkExecutor().execute(validities, context)

      // Assert
      expect(completed.output).toEqual({ action: 'continue' })
      expect(compiledValidation).toHaveBeenCalledWith(expect.any(Object), {
        groups: ['default'],
        includeSubmissionOnly: false,
      })
      expect(compiledValidation).toHaveBeenCalledTimes(1)
      expect(context.state.context.evaluation.reachabilityValidities?.get(validatingStepId)).toEqual(result)
      expect(context.state.context.evaluation.reachabilityValidities?.has(nonValidatingStepId)).toBe(false)
    })

    it('should record navigation facts without touching current-page validation', async () => {
      // Arrange
      const currentStepId = 'current-step' as NodeId
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const compiledValidation: CompiledValidationFunction = vi.fn(() => createStepValidationTask([], []))
      const context = createRequestContext({ currentStepId })
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

import { describe, expect, it, vi } from 'vitest'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import WorkContext from '../../../work/WorkContext'
import WorkExecutor from '../../../work/WorkExecutor'
import type { WorkHandler } from '../../../contracts/work/work.type'
import { createWorkTask } from '../../../work/workTask'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { RequestDependencies } from '../../../runtime/pipeline/RequestState'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import { createTestRequestState } from '../../../runtime/pipeline/testing-helpers/requestStateTestHelpers'
import type { StepValidationWorkProps } from '../contracts/ValidationWork.type'
import { CURRENT_STEP_VALIDATION_WORK_HANDLER } from './CurrentStepValidationWorkHandler'

function createContext(overrides: Partial<RequestDependencies> = {}): WorkContext<RequestState> {
  const context = { evaluation: {}, domain: { data: {}, answers: {} }, request: {} } as RuntimeContext

  return new WorkContext(
    createTestRequestState(context, {
      currentStepId: 'step-1' as NodeId,
      ...overrides,
    }),
  )
}

function stubValidation(result: StepValidityResult) {
  const workHandler: WorkHandler<'validation.step', StepValidationWorkProps> = {
    kind: 'validation.step',
    begin: () => ({ output: result }),
  }

  return createWorkTask('validation:stub', workHandler, { fields: [], domains: [] })
}

describe('CurrentStepValidationWorkHandler', () => {
  describe('execute()', () => {
    it('should run the built validation child and store a valid current-page result', async () => {
      // Arrange
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const buildStepValidation = vi.fn(() => stubValidation(result))
      const context = createContext({ buildStepValidation })
      const validation = createWorkTask('current-step-validation', CURRENT_STEP_VALIDATION_WORK_HANDLER, {
        groups: ['lookup'],
        includeSubmissionOnly: true,
      })

      // Act
      const completed = await new WorkExecutor().execute(validation, context)

      // Assert
      expect(buildStepValidation).toHaveBeenCalledWith('step-1', { groups: ['lookup'], includeSubmissionOnly: true })
      expect(completed.output).toEqual({ isValid: true, fieldFailures: [], domainFailures: [] })
      expect(context.state.currentPageValidation).toEqual({ isValid: true, fieldFailures: [], domainFailures: [] })
      expect(completed.children.map(child => child.key)).toEqual(['validation:stub'])
    })

    it('should store an invalid current-page result when failures are recorded', async () => {
      // Arrange
      const failure = {
        blockId: 'block-1' as NodeId,
        passed: false,
        message: 'Required',
        submissionOnly: false,
        groups: ['default'],
      }
      const result: StepValidityResult = { fieldFailures: [failure], domainFailures: [] }
      const buildStepValidation = vi.fn(() => stubValidation(result))
      const context = createContext({ buildStepValidation })
      const validation = createWorkTask('current-step-validation', CURRENT_STEP_VALIDATION_WORK_HANDLER, {
        groups: ['default'],
        includeSubmissionOnly: false,
      })

      // Act
      await new WorkExecutor().execute(validation, context)

      // Assert
      expect(buildStepValidation).toHaveBeenCalledWith('step-1', { groups: ['default'], includeSubmissionOnly: false })
      expect(context.state.currentPageValidation?.isValid).toBe(false)
      expect(context.state.currentPageValidation?.fieldFailures).toEqual([failure])
    })

    it('should reject when the validation builder returns no task', async () => {
      // Arrange
      const buildStepValidation = vi.fn(() => undefined)
      const validation = createWorkTask('current-step-validation', CURRENT_STEP_VALIDATION_WORK_HANDLER, {
        groups: ['lookup'],
        includeSubmissionOnly: true,
      })

      // Act & Assert
      await expect(new WorkExecutor().execute(validation, createContext({ buildStepValidation }))).rejects.toThrow(
        'Current-step validation task missing',
      )
    })

    it('should reject when no current step id is present', async () => {
      // Arrange
      const validation = createWorkTask('current-step-validation', CURRENT_STEP_VALIDATION_WORK_HANDLER, {
        groups: ['default'],
        includeSubmissionOnly: false,
      })

      // Act & Assert
      await expect(new WorkExecutor().execute(validation, createContext({ currentStepId: undefined }))).rejects.toThrow(
        'Current-step validation requires a current step id',
      )
    })
  })
})

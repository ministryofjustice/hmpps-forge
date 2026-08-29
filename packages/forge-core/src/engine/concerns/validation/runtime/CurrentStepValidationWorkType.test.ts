import { describe, expect, it, vi } from 'vitest'
import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { CompiledValidationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { createWorkTask } from '../../../chassis/work/workTask'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { RuntimeContext } from '../../../chassis/contracts/runtime/evaluationState.type'
import { createTestRequestState } from '../../../chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'
import { CURRENT_STEP_VALIDATION_WORK_HANDLER } from './CurrentStepValidationWorkHandler'
import { createFieldValidationTask } from './FieldValidationWorkHandler'
import { createDomainValidationTask } from './DomainValidationWorkHandler'
import { createStepValidationTask } from './StepValidationWorkHandler'

function createContext(): WorkContext<RequestState> {
  const context = { evaluation: {}, domain: { data: {}, answers: {} }, request: {} } as RuntimeContext

  return new WorkContext(createTestRequestState(context))
}

function stubCompiledValidation(result: StepValidityResult): CompiledValidationFunction {
  return vi.fn(() => {
    const fields =
      result.fieldFailures.length === 0
        ? []
        : [
            createFieldValidationTask('field:stub', {
              blockId: result.fieldFailures[0].blockId,
              blockCode: result.fieldFailures[0].blockCode,
              run: () => result.fieldFailures,
            }),
          ]
    const domains =
      result.domainFailures.length === 0
        ? []
        : [createDomainValidationTask('domain:stub', { run: () => result.domainFailures })]

    return createStepValidationTask(fields, domains)
  })
}

describe('CurrentStepValidationWorkHandler', () => {
  describe('execute()', () => {
    it('should run the built validation child and store a valid current-page result', async () => {
      // Arrange
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const compiledValidation = stubCompiledValidation(result)
      const context = createContext()
      const validation = createWorkTask('current-step-validation', CURRENT_STEP_VALIDATION_WORK_HANDLER, {
        groups: ['lookup'],
        includeSubmissionOnly: true,
        stepId: 'step-1' as NodeId,
        compiledValidation,
      })

      // Act
      const completed = await new WorkExecutor().execute(validation, context)

      // Assert
      expect(compiledValidation).toHaveBeenCalledWith(expect.any(Object), {
        groups: ['lookup'],
        includeSubmissionOnly: true,
      })
      expect(completed.output).toEqual({ isValid: true, fieldFailures: [], domainFailures: [] })
      expect(context.state.currentPageValidation).toEqual({ isValid: true, fieldFailures: [], domainFailures: [] })
      expect(completed.children.map(child => child.key)).toEqual(['validation:step-1'])
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
      const compiledValidation = stubCompiledValidation(result)
      const context = createContext()
      const validation = createWorkTask('current-step-validation', CURRENT_STEP_VALIDATION_WORK_HANDLER, {
        groups: ['default'],
        includeSubmissionOnly: false,
        stepId: 'step-1' as NodeId,
        compiledValidation,
      })

      // Act
      await new WorkExecutor().execute(validation, context)

      // Assert
      expect(compiledValidation).toHaveBeenCalledWith(expect.any(Object), {
        groups: ['default'],
        includeSubmissionOnly: false,
      })
      expect(context.state.currentPageValidation?.isValid).toBe(false)
      expect(context.state.currentPageValidation?.fieldFailures).toEqual([failure])
    })

    it('should reject when the validation builder returns no task', async () => {
      // Arrange
      const compiledValidation = vi.fn(() => undefined) as unknown as CompiledValidationFunction
      const validation = createWorkTask('current-step-validation', CURRENT_STEP_VALIDATION_WORK_HANDLER, {
        groups: ['lookup'],
        includeSubmissionOnly: true,
        stepId: 'step-1' as NodeId,
        compiledValidation,
      })

      // Act & Assert
      await expect(new WorkExecutor().execute(validation, createContext())).rejects.toThrow(
        'Current-step validation task missing',
      )
    })
  })
})

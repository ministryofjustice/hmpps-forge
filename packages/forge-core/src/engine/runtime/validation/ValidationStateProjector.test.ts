import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { StepValidityResult } from './StepValidityAnalyzer'
import RuntimeArtifacts from '../RuntimeArtifacts'
import ValidationStateProjector from './ValidationStateProjector'

describe('ValidationStateProjector', () => {
  const projector = new ValidationStateProjector()

  it('should write validation result to context.global.validation', () => {
    // Arrange
    const context = {
      global: { data: {}, answers: {} },
    } as unknown as ThunkEvaluationContext

    const result: StepValidityResult = {
      isValid: false,
      fieldFailures: [
        {
          blockId: 'compile_ast:1',
          passed: false,
          message: 'Required',
          submissionOnly: false,
        },
      ],
      domainFailures: [
        {
          passed: false,
          message: 'Domain error',
          submissionOnly: false,
        },
      ],
    }
    const artifacts = new RuntimeArtifacts()

    artifacts.setStepValidity(result)

    // Act
    projector.project('compile_ast:10', artifacts, context)

    // Assert
    expect(context.global.validation).toEqual({
      stepId: 'compile_ast:10',
      validated: true,
      isValid: false,
      fieldFailures: [{ blockId: 'compile_ast:1', passed: false, message: 'Required', submissionOnly: false }],
      domainFailures: [{ passed: false, message: 'Domain error', submissionOnly: false }],
    })
  })

  it('should write valid result to context.global.validation', () => {
    // Arrange
    const context = {
      global: { data: {}, answers: {} },
    } as unknown as ThunkEvaluationContext

    const result: StepValidityResult = {
      isValid: true,
      fieldFailures: [],
      domainFailures: [],
    }
    const artifacts = new RuntimeArtifacts()

    artifacts.setStepValidity(result)

    // Act
    projector.project('compile_ast:20', artifacts, context)

    // Assert
    expect(context.global.validation).toEqual({
      stepId: 'compile_ast:20',
      validated: true,
      isValid: true,
      fieldFailures: [],
      domainFailures: [],
    })
  })
})

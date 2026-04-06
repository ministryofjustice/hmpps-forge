import { NavigationEvaluation } from '../types/NavigationEvaluation.type'
import BacklinkResolver from './BacklinkResolver'

describe('BacklinkResolver', () => {
  const resolver = new BacklinkResolver()

  it('should return the current step predecessor when exactly one exists', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:64',
      steps: [
        {
          stepId: 'compile_ast:64',
          path: 'third',
          isEntryPoint: false,
          isReachable: true,
          isValid: true,
          predecessorPaths: ['second'],
        },
      ],
    }

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('second')
  })

  it('should return undefined for entry steps', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:65',
      steps: [
        {
          stepId: 'compile_ast:65',
          path: 'entry',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
      ],
    }

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when the current step has multiple predecessors', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:72',
      steps: [
        {
          stepId: 'compile_ast:72',
          path: 'converge',
          isEntryPoint: false,
          isReachable: true,
          isValid: true,
          predecessorPaths: ['branch-a', 'branch-b'],
        },
      ],
    }

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })
})

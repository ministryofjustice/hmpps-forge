import { NavigationEvaluation } from '../types/NavigationEvaluation.type'
import RedirectResolver from './RedirectResolver'

function createEvaluation(overrides: Partial<NavigationEvaluation> = {}): NavigationEvaluation {
  return {
    currentStepId: 'compile_ast:3',
    steps: [],
    ...overrides,
  }
}

describe('RedirectResolver', () => {
  const resolver = new RedirectResolver()

  it('should return undefined when the current step is reachable', () => {
    // Arrange
    const evaluation = createEvaluation({
      steps: [
        {
          stepId: 'compile_ast:3',
          path: 'current',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
      ],
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return the single reachable invalid blocker', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:11',
      steps: [
        {
          stepId: 'compile_ast:7',
          path: 'one',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
        {
          stepId: 'compile_ast:9',
          path: 'two',
          isEntryPoint: false,
          isReachable: true,
          isValid: false,
          predecessorPaths: ['one'],
        },
        {
          stepId: 'compile_ast:11',
          path: 'three',
          isEntryPoint: false,
          isReachable: false,
          isValid: true,
          predecessorPaths: [],
        },
      ],
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('two')
  })

  it('should fall back to the first reachable entry point when multiple blockers exist', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:20',
      steps: [
        {
          stepId: 'compile_ast:12',
          path: 'entry-a',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
        {
          stepId: 'compile_ast:14',
          path: 'entry-b',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
        {
          stepId: 'compile_ast:16',
          path: 'middle-a',
          isEntryPoint: false,
          isReachable: true,
          isValid: false,
          predecessorPaths: ['entry-a'],
        },
        {
          stepId: 'compile_ast:18',
          path: 'middle-b',
          isEntryPoint: false,
          isReachable: true,
          isValid: false,
          predecessorPaths: ['entry-b'],
        },
        {
          stepId: 'compile_ast:20',
          path: 'target',
          isEntryPoint: false,
          isReachable: false,
          isValid: true,
          predecessorPaths: [],
        },
      ],
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('entry-a')
  })
})

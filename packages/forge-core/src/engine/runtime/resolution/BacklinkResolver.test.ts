import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import BacklinkResolver from './BacklinkResolver'

describe('BacklinkResolver', () => {
  const resolver = new BacklinkResolver()

  function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
    return {
      stepId: 'compile_ast:64',
      routeTemplatePath: '/journey/current',
      isEntryPoint: false,
      isReachable: true,
      isValid: true,
      forwardRouteTemplatePaths: [],
      predecessorRouteTemplatePaths: [],
      ...overrides,
    }
  }

  it('should return the current step predecessor when exactly one exists', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:64',
      steps: [
        createNavigationStep({
          routeTemplatePath: '/journey/third',
          predecessorRouteTemplatePaths: ['/journey/second'],
        }),
      ],
    }

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('/journey/second')
  })

  it('should return undefined for entry steps', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:65',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:65',
          routeTemplatePath: '/journey/entry',
          isEntryPoint: true,
        }),
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
        createNavigationStep({
          stepId: 'compile_ast:72',
          routeTemplatePath: '/journey/converge',
          predecessorRouteTemplatePaths: ['/journey/branch-a', '/journey/branch-b'],
        }),
      ],
    }

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })
})

import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
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

  function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
    return {
      stepId: 'compile_ast:3',
      routeTemplatePath: '/journey/current',
      isEntryPoint: false,
      isReachable: true,
      isValid: true,
      forwardRouteTemplatePaths: [],
      predecessorRouteTemplatePaths: [],
      ...overrides,
    }
  }

  it('should return undefined when the current step is reachable', () => {
    // Arrange
    const evaluation = createEvaluation({
      steps: [
        createNavigationStep({
          isEntryPoint: true,
        }),
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
        createNavigationStep({
          stepId: 'compile_ast:7',
          routeTemplatePath: '/journey/one',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepId: 'compile_ast:9',
          routeTemplatePath: '/journey/two',
          isValid: false,
          predecessorRouteTemplatePaths: ['/journey/one'],
        }),
        createNavigationStep({
          stepId: 'compile_ast:11',
          routeTemplatePath: '/journey/three',
          isReachable: false,
        }),
      ],
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('/journey/two')
  })

  it('should fall back to the first reachable entry point when multiple blockers exist', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:20',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:12',
          routeTemplatePath: '/journey/entry-a',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepId: 'compile_ast:14',
          routeTemplatePath: '/journey/entry-b',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepId: 'compile_ast:16',
          routeTemplatePath: '/journey/middle-a',
          isValid: false,
          predecessorRouteTemplatePaths: ['/journey/entry-a'],
        }),
        createNavigationStep({
          stepId: 'compile_ast:18',
          routeTemplatePath: '/journey/middle-b',
          isValid: false,
          predecessorRouteTemplatePaths: ['/journey/entry-b'],
        }),
        createNavigationStep({
          stepId: 'compile_ast:20',
          routeTemplatePath: '/journey/target',
          isReachable: false,
        }),
      ],
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('/journey/entry-a')
  })
})

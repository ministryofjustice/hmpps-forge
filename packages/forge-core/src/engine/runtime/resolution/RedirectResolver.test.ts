import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import RedirectResolver from './RedirectResolver'

function createEvaluation(overrides: Partial<NavigationEvaluation> = {}): NavigationEvaluation {
  return {
    currentStepId: 'compile_ast:3',
    steps: [],
    resumeActive: false,
    redirectTargetRouteTemplatePath: undefined,
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
      isConditionalEntry: false,
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
      steps: [createNavigationStep({ isEntryPoint: true })],
      redirectTargetRouteTemplatePath: '/journey/frontier',
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return the resume frontier when the current step is unreachable', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:11',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:11',
          routeTemplatePath: '/journey/unreachable',
          isReachable: false,
        }),
      ],
      redirectTargetRouteTemplatePath: '/journey/frontier',
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('/journey/frontier')
  })

  it('should return undefined when the current step cannot be found', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:999',
      steps: [],
      redirectTargetRouteTemplatePath: '/journey/frontier',
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when the current step is unreachable and the evaluation has no frontier', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:11',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:11',
          routeTemplatePath: '/journey/unreachable',
          isReachable: false,
        }),
      ],
      redirectTargetRouteTemplatePath: undefined,
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should redirect to frontier when resume is active even if step is reachable', () => {
    // Arrange
    const evaluation = createEvaluation({
      steps: [createNavigationStep({ isReachable: true })],
      resumeActive: true,
      redirectTargetRouteTemplatePath: '/journey/frontier',
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBe('/journey/frontier')
  })

  it('should not redirect when resume is active and already at the frontier', () => {
    // Arrange
    const evaluation = createEvaluation({
      steps: [createNavigationStep({ routeTemplatePath: '/journey/frontier' })],
      resumeActive: true,
      redirectTargetRouteTemplatePath: '/journey/frontier',
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should not redirect when resume is active but frontier is undefined', () => {
    // Arrange
    const evaluation = createEvaluation({
      steps: [createNavigationStep()],
      resumeActive: true,
      redirectTargetRouteTemplatePath: undefined,
    })

    // Act
    const result = resolver.resolve(evaluation)

    // Assert
    expect(result).toBeUndefined()
  })
})

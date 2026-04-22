import { NavigationEvaluation, NavigationStepState } from './NavigationEvaluation.type'
import BacklinkResolver from './BacklinkResolver'

function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
  return {
    stepId: 'compile_ast:64',
    routeTemplatePath: '/journey/current',
    declarationIndex: 0,
    isEntryPoint: false,
    isConditionalEntry: false,
    hasValidation: false,
    isReachable: true,
    isValid: true,
    forwardRouteTemplatePaths: [],
    predecessorRouteTemplatePaths: [],
    ...overrides,
  }
}

function createEvaluation(overrides: Partial<NavigationEvaluation>): NavigationEvaluation {
  return {
    currentStepId: undefined,
    steps: [],
    defaultEntryRouteTemplatePath: undefined,
    frontierRouteTemplatePath: undefined,
    canonicalPathRouteTemplatePaths: [],
    progressExists: false,
    resumeActive: false,
    resumeOutcome: 'no-op',
    ...overrides,
  }
}

describe('BacklinkResolver', () => {
  const resolver = new BacklinkResolver()

  it('should return the previous step on the canonical path', () => {
    // Arrange
    const step = createNavigationStep({
      stepId: 'compile_ast:72',
      routeTemplatePath: '/journey/converge',
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:72',
      steps: [step],
      canonicalPathRouteTemplatePaths: ['/journey/start', '/journey/branch-b', '/journey/converge'],
    })

    // Act
    const result = resolver.resolveForStep(step, evaluation.canonicalPathRouteTemplatePaths)

    // Assert
    expect(result).toBe('/journey/branch-b')
  })

  it('should return undefined for the first step on the canonical path', () => {
    // Arrange
    const step = createNavigationStep({
      stepId: 'compile_ast:65',
      routeTemplatePath: '/journey/entry',
      isEntryPoint: true,
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:65',
      steps: [step],
      canonicalPathRouteTemplatePaths: ['/journey/entry', '/journey/next'],
    })

    // Act
    const result = resolver.resolveForStep(step, evaluation.canonicalPathRouteTemplatePaths)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when the step is not on the canonical path', () => {
    // Arrange
    const step = createNavigationStep({
      stepId: 'compile_ast:66',
      routeTemplatePath: '/journey/other-branch',
    })

    // Act
    const result = resolver.resolveForStep(step, ['/journey/start', '/journey/branch-a'])

    // Assert
    expect(result).toBeUndefined()
  })
})

import { NavigationEvaluation, NavigationStepState } from '../../types/NavigationEvaluation.type'
import {
  resolveBacklinkRouteTemplatePath,
  resolveJourneyRootRedirect,
  resolveStepRequestRedirect,
} from './NavigationAnalyzer'

function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
  return {
    stepId: 'compile_ast:500',
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

function createEvaluation(overrides: Partial<NavigationEvaluation> = {}): NavigationEvaluation {
  return {
    currentStepId: 'compile_ast:500',
    steps: [createNavigationStep()],
    defaultEntryRouteTemplatePath: '/journey/entry',
    frontierRouteTemplatePath: undefined,
    canonicalPathRouteTemplatePaths: [],
    progressExists: false,
    resumeActive: false,
    resumeOutcome: 'no-op',
    ...overrides,
  }
}

describe('NavigationAnalyzer', () => {
  it('should resolve backlink from canonical navigation path', () => {
    // Arrange
    const evaluation = createEvaluation({
      steps: [createNavigationStep({ routeTemplatePath: '/journey/current' })],
      canonicalPathRouteTemplatePaths: ['/journey/previous', '/journey/current'],
    })

    // Act
    const result = resolveBacklinkRouteTemplatePath(evaluation)

    // Assert
    expect(result).toBe('/journey/previous')
  })

  it('should redirect step requests to resume frontier when resume is active', () => {
    // Arrange
    const evaluation = createEvaluation({
      frontierRouteTemplatePath: '/journey/frontier',
      progressExists: true,
      resumeActive: true,
      resumeOutcome: 'redirect',
    })

    // Act
    const result = resolveStepRequestRedirect(evaluation)

    // Assert
    expect(result).toBe('/journey/frontier')
  })

  it('should redirect unreachable step requests to the default entry', () => {
    // Arrange
    const unreachable = createNavigationStep({ isReachable: false })
    const evaluation = createEvaluation({
      currentStepId: unreachable.stepId,
      steps: [unreachable],
    })

    // Act
    const result = resolveStepRequestRedirect(evaluation)

    // Assert
    expect(result).toBe('/journey/entry')
  })

  it('should redirect journey root requests to the resume frontier before default entry', () => {
    // Arrange
    const evaluation = createEvaluation({
      frontierRouteTemplatePath: '/journey/frontier',
      progressExists: true,
      resumeActive: true,
      resumeOutcome: 'redirect',
    })

    // Act
    const result = resolveJourneyRootRedirect(evaluation)

    // Assert
    expect(result).toBe('/journey/frontier')
  })
})

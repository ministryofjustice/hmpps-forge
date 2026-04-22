import NavigationDecisionResolver from './NavigationDecisionResolver'
import { NavigationEvaluation, NavigationStepState } from './NavigationEvaluation.type'

function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
  return {
    stepId: 'compile_ast:3',
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
    currentStepId: 'compile_ast:3',
    steps: [createNavigationStep()],
    defaultEntryRouteTemplatePath: '/journey/entry',
    frontierRouteTemplatePath: undefined,
    canonicalPathRouteTemplatePaths: ['/journey/current'],
    progressExists: false,
    resumeActive: false,
    resumeOutcome: 'no-op',
    ...overrides,
  }
}

describe('NavigationDecisionResolver', () => {
  const resolver = new NavigationDecisionResolver()

  describe('resolveStepRequestRedirect()', () => {
    it('should redirect to the frontier when resume produces a redirect', () => {
      // Arrange
      const evaluation = createEvaluation({
        frontierRouteTemplatePath: '/journey/frontier',
        resumeActive: true,
        resumeOutcome: 'redirect',
      })

      // Act
      const result = resolver.resolveStepRequestRedirect(evaluation)

      // Assert
      expect(result).toBe('/journey/frontier')
    })

    it('should render the current step when resume is a no-op and the step is reachable', () => {
      // Arrange
      const evaluation = createEvaluation()

      // Act
      const result = resolver.resolveStepRequestRedirect(evaluation)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should redirect unreachable step requests to the default entry when resume is a no-op', () => {
      // Arrange
      const evaluation = createEvaluation({
        steps: [createNavigationStep({ isReachable: false })],
      })

      // Act
      const result = resolver.resolveStepRequestRedirect(evaluation)

      // Assert
      expect(result).toBe('/journey/entry')
    })
  })

  describe('resolveJourneyRootRedirect()', () => {
    it('should redirect journey root requests to the frontier when resume produces a redirect', () => {
      // Arrange
      const evaluation = createEvaluation({
        currentStepId: undefined,
        frontierRouteTemplatePath: '/journey/frontier',
        resumeActive: true,
        resumeOutcome: 'redirect',
      })

      // Act
      const result = resolver.resolveJourneyRootRedirect(evaluation)

      // Assert
      expect(result).toBe('/journey/frontier')
    })

    it('should fall back to the default entry when resume is a no-op', () => {
      // Arrange
      const evaluation = createEvaluation({
        currentStepId: undefined,
      })

      // Act
      const result = resolver.resolveJourneyRootRedirect(evaluation)

      // Assert
      expect(result).toBe('/journey/entry')
    })
  })
})

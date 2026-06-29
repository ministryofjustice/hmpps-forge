import { ReachabilityEvaluation, ReachabilityNode } from '../../../../contracts/navigation/reachabilityEvaluation.type'
import { resolveBacklinkRouteTemplatePath, resolveRedirect } from './navigationRedirects'

function createNavigationStep(overrides: Partial<ReachabilityNode> = {}): ReachabilityNode {
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

function createEvaluation(overrides: Partial<ReachabilityEvaluation> = {}): ReachabilityEvaluation {
  return {
    currentStepId: 'compile_ast:500',
    steps: [createNavigationStep()],
    defaultEntryRouteTemplatePath: '/journey/entry',
    frontierRouteTemplatePath: undefined,
    canonicalPathRouteTemplatePaths: [],
    progressExists: false,
    resumeActive: false,
    resumeOutcome: 'no-op',
    unreachableRedirect: 'entry',
    cleardownRetentionRouteTemplatePaths: [],
    ...overrides,
  }
}

describe('navigationRedirects', () => {
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

  it('should redirect GET step requests to resume frontier when resume is active', () => {
    // Arrange
    const evaluation = createEvaluation({
      frontierRouteTemplatePath: '/journey/frontier',
      progressExists: true,
      resumeActive: true,
      resumeOutcome: 'redirect',
    })

    // Act
    const result = resolveRedirect(evaluation, 'step', 'GET')

    // Assert
    expect(result).toBe('/journey/frontier')
  })

  it('should redirect unreachable GET step requests to the default entry', () => {
    // Arrange
    const unreachable = createNavigationStep({ isReachable: false })
    const evaluation = createEvaluation({
      currentStepId: unreachable.stepId,
      steps: [unreachable],
    })

    // Act
    const result = resolveRedirect(evaluation, 'step', 'GET')

    // Assert
    expect(result).toBe('/journey/entry')
  })

  it('should redirect unreachable GET step requests to the frontier when configured', () => {
    // Arrange
    const unreachable = createNavigationStep({ isReachable: false })
    const evaluation = createEvaluation({
      currentStepId: unreachable.stepId,
      steps: [unreachable],
      frontierRouteTemplatePath: '/journey/frontier',
      unreachableRedirect: 'frontier',
    })

    // Act
    const result = resolveRedirect(evaluation, 'step', 'GET')

    // Assert
    expect(result).toBe('/journey/frontier')
  })

  it('should fall back to the default entry when frontier redirect is configured without a frontier', () => {
    // Arrange
    const unreachable = createNavigationStep({ isReachable: false })
    const evaluation = createEvaluation({
      currentStepId: unreachable.stepId,
      steps: [unreachable],
      unreachableRedirect: 'frontier',
    })

    // Act
    const result = resolveRedirect(evaluation, 'step', 'GET')

    // Assert
    expect(result).toBe('/journey/entry')
  })

  it('should redirect to resume frontier before unreachable redirect config on GET step requests', () => {
    // Arrange
    const unreachable = createNavigationStep({ isReachable: false })
    const evaluation = createEvaluation({
      currentStepId: unreachable.stepId,
      steps: [unreachable],
      defaultEntryRouteTemplatePath: '/journey/entry',
      frontierRouteTemplatePath: '/journey/resume-frontier',
      resumeOutcome: 'redirect',
      unreachableRedirect: 'entry',
    })

    // Act
    const result = resolveRedirect(evaluation, 'step', 'GET')

    // Assert
    expect(result).toBe('/journey/resume-frontier')
  })

  it('should use unreachable redirect config for POST step requests', () => {
    // Arrange
    const unreachable = createNavigationStep({ isReachable: false })
    const evaluation = createEvaluation({
      currentStepId: unreachable.stepId,
      steps: [unreachable],
      frontierRouteTemplatePath: '/journey/frontier',
      unreachableRedirect: 'frontier',
    })

    // Act
    const result = resolveRedirect(evaluation, 'step', 'POST')

    // Assert
    expect(result).toBe('/journey/frontier')
  })

  it('should redirect journey requests to the resume frontier before default entry', () => {
    // Arrange
    const evaluation = createEvaluation({
      frontierRouteTemplatePath: '/journey/frontier',
      progressExists: true,
      resumeActive: true,
      resumeOutcome: 'redirect',
    })

    // Act
    const result = resolveRedirect(evaluation, 'journey', 'GET')

    // Assert
    expect(result).toBe('/journey/frontier')
  })
})

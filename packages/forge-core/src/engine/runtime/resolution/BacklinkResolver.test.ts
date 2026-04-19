import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import BacklinkResolver from './BacklinkResolver'

describe('BacklinkResolver', () => {
  const resolver = new BacklinkResolver()

  function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
    return {
      stepId: 'compile_ast:64',
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

  function createEvaluation(overrides: Partial<NavigationEvaluation>): NavigationEvaluation {
    return {
      currentStepId: undefined,
      steps: [],
      redirectTargetRouteTemplatePath: undefined,
      resumeActive: false,
      ...overrides,
    }
  }

  it('should return the current step predecessor when exactly one exists', () => {
    // Arrange
    const step = createNavigationStep({
      routeTemplatePath: '/journey/third',
      predecessorRouteTemplatePaths: ['/journey/second'],
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:64',
      steps: [step],
    })

    // Act
    const result = resolver.resolveForStep(step, evaluation.steps)

    // Assert
    expect(result).toBe('/journey/second')
  })

  it('should return undefined for entry steps', () => {
    // Arrange
    const step = createNavigationStep({
      stepId: 'compile_ast:65',
      routeTemplatePath: '/journey/entry',
      isEntryPoint: true,
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:65',
      steps: [step],
    })

    // Act
    const result = resolver.resolveForStep(step, evaluation.steps)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should fall back to journey order when multiple predecessors have no tie-breakers', () => {
    // Arrange
    const convergeStep = createNavigationStep({
      stepId: 'compile_ast:72',
      routeTemplatePath: '/journey/converge',
      predecessorRouteTemplatePaths: ['/journey/branch-a', '/journey/branch-b'],
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:72',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:70',
          routeTemplatePath: '/journey/branch-a',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepId: 'compile_ast:71',
          routeTemplatePath: '/journey/branch-b',
          isEntryPoint: true,
        }),
        convergeStep,
      ],
    })

    // Act
    const result = resolver.resolveForStep(convergeStep, evaluation.steps)

    // Assert
    expect(result).toBe('/journey/branch-a')
  })

  it('should pick the predecessor with the highest tie-breaker priority', () => {
    // Arrange
    const convergeStep = createNavigationStep({
      stepId: 'compile_ast:82',
      routeTemplatePath: '/journey/converge',
      predecessorRouteTemplatePaths: ['/journey/branch-a', '/journey/branch-b'],
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:82',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:80',
          routeTemplatePath: '/journey/branch-a',
          isEntryPoint: true,
          tieBreakerPriority: 10,
        }),
        createNavigationStep({
          stepId: 'compile_ast:81',
          routeTemplatePath: '/journey/branch-b',
          isEntryPoint: true,
          tieBreakerPriority: 100,
        }),
        convergeStep,
      ],
    })

    // Act
    const result = resolver.resolveForStep(convergeStep, evaluation.steps)

    // Assert
    expect(result).toBe('/journey/branch-b')
  })

  it('should prefer a matched predecessor over an unmatched one regardless of order', () => {
    // Arrange
    const convergeStep = createNavigationStep({
      stepId: 'compile_ast:92',
      routeTemplatePath: '/journey/converge',
      predecessorRouteTemplatePaths: ['/journey/unmatched-first', '/journey/matched-second'],
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:92',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:90',
          routeTemplatePath: '/journey/unmatched-first',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepId: 'compile_ast:91',
          routeTemplatePath: '/journey/matched-second',
          isEntryPoint: true,
          tieBreakerPriority: 1,
        }),
        convergeStep,
      ],
    })

    // Act
    const result = resolver.resolveForStep(convergeStep, evaluation.steps)

    // Assert
    expect(result).toBe('/journey/matched-second')
  })

  it('should return undefined when the current step has no predecessors', () => {
    // Arrange
    const step = createNavigationStep({
      stepId: 'compile_ast:99',
      routeTemplatePath: '/journey/orphan',
    })
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:99',
      steps: [step],
    })

    // Act
    const result = resolver.resolveForStep(step, evaluation.steps)

    // Assert
    expect(result).toBeUndefined()
  })
})

import ReachabilityStateProjector from './ReachabilityStateProjector'
import { NavigationEvaluation, NavigationStepState } from '../../contracts/navigation/navigationEvaluation.type'
import { StepFieldInventory } from '../../contracts/plans/stepFieldInventory.type'

describe('ReachabilityStateProjector', () => {
  const projector = new ReachabilityStateProjector()

  function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
    return {
      stepNodeId: 'compile_ast:40',
      routeTemplatePath: '/journey/step-a',
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
      currentStepNodeId: undefined,
      steps: [],
      defaultEntryRouteTemplatePath: undefined,
      frontierRouteTemplatePath: undefined,
      canonicalPathRouteTemplatePaths: [],
      progressExists: false,
      resumeActive: false,
      resumeOutcome: 'no-op',
      unreachableRedirect: 'entry',
      ...overrides,
    }
  }

  it('should omit fieldCodes when no field blocks exist', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepNodeId: 'compile_ast:40',
      steps: [
        createNavigationStep({
          code: 'step-a',
          isEntryPoint: true,
        }),
      ],
    })

    const fieldInventory: StepFieldInventory[] = [
      { stepNodeId: 'compile_ast:40', fieldCodes: [], cleardownFieldCodes: [] },
    ]

    // Act
    const result = projector.project(evaluation, fieldInventory, {})

    // Assert
    expect(result.reachableSteps[0].fieldCodes).toBeUndefined()
  })

  it('should project cleardown field codes for reachable steps', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepNodeId: 'compile_ast:42',
      steps: [
        createNavigationStep({
          stepNodeId: 'compile_ast:42',
          code: 'step-a',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepNodeId: 'compile_ast:43',
          routeTemplatePath: '/journey/step-b',
          isReachable: false,
        }),
      ],
    })

    const fieldInventory: StepFieldInventory[] = [
      { stepNodeId: 'compile_ast:42', fieldCodes: [], cleardownFieldCodes: ['fieldA', '^task_\\d+$'] },
      { stepNodeId: 'compile_ast:43', fieldCodes: [], cleardownFieldCodes: [] },
    ]

    // Act
    const result = projector.project(evaluation, fieldInventory, {})

    // Assert
    expect(result.reachableSteps[0].cleardownFieldCodes).toEqual(['fieldA', '^task_\\d+$'])
    expect(result.unreachableSteps[0].cleardownFieldCodes).toBeUndefined()
  })

  it('should project back path when a step has a single predecessor', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepNodeId: 'compile_ast:54',
      steps: [
        createNavigationStep({
          stepNodeId: 'compile_ast:50',
          routeTemplatePath: '/journey/first',
          isEntryPoint: true,
          declarationIndex: 0,
        }),
        createNavigationStep({
          stepNodeId: 'compile_ast:52',
          routeTemplatePath: '/journey/second',
          declarationIndex: 1,
        }),
        createNavigationStep({
          stepNodeId: 'compile_ast:54',
          routeTemplatePath: '/journey/third',
          declarationIndex: 2,
        }),
      ],
      canonicalPathRouteTemplatePaths: ['/journey/first', '/journey/second', '/journey/third'],
    })

    const fieldInventory: StepFieldInventory[] = [
      { stepNodeId: 'compile_ast:50', fieldCodes: [], cleardownFieldCodes: [] },
      { stepNodeId: 'compile_ast:52', fieldCodes: [], cleardownFieldCodes: [] },
      { stepNodeId: 'compile_ast:54', fieldCodes: [], cleardownFieldCodes: [] },
    ]

    // Act
    const result = projector.project(evaluation, fieldInventory, {})

    // Assert
    const first = result.reachableSteps.find(step => step.path === '/journey/first')
    const second = result.reachableSteps.find(step => step.path === '/journey/second')
    const third = result.reachableSteps.find(step => step.path === '/journey/third')

    expect(first?.backPath).toBeUndefined()
    expect(second?.backPath).toBe('/journey/first')
    expect(third?.backPath).toBe('/journey/second')
  })

  it('should omit back path when a step is outside the canonical path', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepNodeId: 'compile_ast:59',
      steps: [
        createNavigationStep({
          stepNodeId: 'compile_ast:59',
          routeTemplatePath: '/journey/converge',
        }),
      ],
      canonicalPathRouteTemplatePaths: ['/journey/branch-a', '/journey/branch-b'],
    })

    const fieldInventory: StepFieldInventory[] = [
      { stepNodeId: 'compile_ast:59', fieldCodes: [], cleardownFieldCodes: [] },
    ]

    // Act
    const result = projector.project(evaluation, fieldInventory, {})

    // Assert
    expect(result.reachableSteps[0].backPath).toBeUndefined()
  })
})

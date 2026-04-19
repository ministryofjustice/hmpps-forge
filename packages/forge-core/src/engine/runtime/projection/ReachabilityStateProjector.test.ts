import ReachabilityStateProjector from './ReachabilityStateProjector'
import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import RuntimeArtifacts from '../RuntimeArtifacts'
import { StepFieldInventory } from '../types/StepFieldInventory.type'

describe('ReachabilityStateProjector', () => {
  const projector = new ReachabilityStateProjector()

  function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
    return {
      stepId: 'compile_ast:40',
      routeTemplatePath: '/journey/step-a',
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

  it('should omit fieldCodes when no field blocks exist', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:40',
      steps: [
        createNavigationStep({
          code: 'step-a',
          isEntryPoint: true,
        }),
      ],
    })

    const fieldInventory: StepFieldInventory[] = [{ stepId: 'compile_ast:40', fieldCodes: [], cleardownFieldCodes: [] }]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts, {})

    // Assert
    expect(result.reachableSteps[0].fieldCodes).toBeUndefined()
  })

  it('should project cleardown field codes for reachable steps', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:42',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:42',
          code: 'step-a',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepId: 'compile_ast:43',
          routeTemplatePath: '/journey/step-b',
          isReachable: false,
        }),
      ],
    })

    const fieldInventory: StepFieldInventory[] = [
      { stepId: 'compile_ast:42', fieldCodes: [], cleardownFieldCodes: ['fieldA', '^task_\\d+$'] },
      { stepId: 'compile_ast:43', fieldCodes: [], cleardownFieldCodes: [] },
    ]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts, {})

    // Assert
    expect(result.reachableSteps[0].cleardownFieldCodes).toEqual(['fieldA', '^task_\\d+$'])
    expect(result.unreachableSteps[0].cleardownFieldCodes).toBeUndefined()
  })

  it('should project back path when a step has a single predecessor', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:54',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:50',
          routeTemplatePath: '/journey/first',
          isEntryPoint: true,
        }),
        createNavigationStep({
          stepId: 'compile_ast:52',
          routeTemplatePath: '/journey/second',
          predecessorRouteTemplatePaths: ['/journey/first'],
        }),
        createNavigationStep({
          stepId: 'compile_ast:54',
          routeTemplatePath: '/journey/third',
          predecessorRouteTemplatePaths: ['/journey/second'],
        }),
      ],
    })

    const fieldInventory: StepFieldInventory[] = [
      { stepId: 'compile_ast:50', fieldCodes: [], cleardownFieldCodes: [] },
      { stepId: 'compile_ast:52', fieldCodes: [], cleardownFieldCodes: [] },
      { stepId: 'compile_ast:54', fieldCodes: [], cleardownFieldCodes: [] },
    ]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts, {})

    // Assert
    const first = result.reachableSteps.find(step => step.path === '/journey/first')
    const second = result.reachableSteps.find(step => step.path === '/journey/second')
    const third = result.reachableSteps.find(step => step.path === '/journey/third')

    expect(first?.backPath).toBeUndefined()
    expect(second?.backPath).toBe('/journey/first')
    expect(third?.backPath).toBe('/journey/second')
  })

  it('should omit back path when a step has multiple predecessors', () => {
    // Arrange
    const evaluation = createEvaluation({
      currentStepId: 'compile_ast:59',
      steps: [
        createNavigationStep({
          stepId: 'compile_ast:59',
          routeTemplatePath: '/journey/converge',
          predecessorRouteTemplatePaths: ['/journey/branch-a', '/journey/branch-b'],
        }),
      ],
    })

    const fieldInventory: StepFieldInventory[] = [{ stepId: 'compile_ast:59', fieldCodes: [], cleardownFieldCodes: [] }]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts, {})

    // Assert
    expect(result.reachableSteps[0].backPath).toBeUndefined()
  })
})

import ReachabilityStateProjector from './ReachabilityStateProjector'
import { NavigationEvaluation } from '../types/NavigationEvaluation.type'
import RuntimeArtifacts from '../types/RuntimeArtifacts'
import { StepFieldInventory } from '../types/StepFieldInventory.type'

describe('ReachabilityStateProjector', () => {
  const projector = new ReachabilityStateProjector()

  it('should omit fieldCodes when no field blocks exist', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:40',
      steps: [
        {
          stepId: 'compile_ast:40',
          path: 'step-a',
          code: 'step-a',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
      ],
    }

    const fieldInventory: StepFieldInventory[] = [{ stepId: 'compile_ast:40', fieldCodes: [], cleardownFieldCodes: [] }]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts)

    // Assert
    expect(result.reachableSteps[0].fieldCodes).toBeUndefined()
  })

  it('should project cleardown field codes for reachable steps', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:42',
      steps: [
        {
          stepId: 'compile_ast:42',
          path: 'step-a',
          code: 'step-a',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
        {
          stepId: 'compile_ast:43',
          path: 'step-b',
          isEntryPoint: false,
          isReachable: false,
          isValid: true,
          predecessorPaths: [],
        },
      ],
    }

    const fieldInventory: StepFieldInventory[] = [
      { stepId: 'compile_ast:42', fieldCodes: [], cleardownFieldCodes: ['fieldA', '^task_\\d+$'] },
      { stepId: 'compile_ast:43', fieldCodes: [], cleardownFieldCodes: [] },
    ]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts)

    // Assert
    expect(result.reachableSteps[0].cleardownFieldCodes).toEqual(['fieldA', '^task_\\d+$'])
    expect(result.unreachableSteps[0].cleardownFieldCodes).toBeUndefined()
  })

  it('should project back path when a step has a single predecessor', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:54',
      steps: [
        {
          stepId: 'compile_ast:50',
          path: 'first',
          isEntryPoint: true,
          isReachable: true,
          isValid: true,
          predecessorPaths: [],
        },
        {
          stepId: 'compile_ast:52',
          path: 'second',
          isEntryPoint: false,
          isReachable: true,
          isValid: true,
          predecessorPaths: ['first'],
        },
        {
          stepId: 'compile_ast:54',
          path: 'third',
          isEntryPoint: false,
          isReachable: true,
          isValid: true,
          predecessorPaths: ['second'],
        },
      ],
    }

    const fieldInventory: StepFieldInventory[] = [
      { stepId: 'compile_ast:50', fieldCodes: [], cleardownFieldCodes: [] },
      { stepId: 'compile_ast:52', fieldCodes: [], cleardownFieldCodes: [] },
      { stepId: 'compile_ast:54', fieldCodes: [], cleardownFieldCodes: [] },
    ]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts)

    // Assert
    const first = result.reachableSteps.find(step => step.path === 'first')
    const second = result.reachableSteps.find(step => step.path === 'second')
    const third = result.reachableSteps.find(step => step.path === 'third')

    expect(first?.backPath).toBeUndefined()
    expect(second?.backPath).toBe('first')
    expect(third?.backPath).toBe('second')
  })

  it('should omit back path when a step has multiple predecessors', () => {
    // Arrange
    const evaluation: NavigationEvaluation = {
      currentStepId: 'compile_ast:59',
      steps: [
        {
          stepId: 'compile_ast:59',
          path: 'converge',
          isEntryPoint: false,
          isReachable: true,
          isValid: true,
          predecessorPaths: ['branch-a', 'branch-b'],
        },
      ],
    }

    const fieldInventory: StepFieldInventory[] = [{ stepId: 'compile_ast:59', fieldCodes: [], cleardownFieldCodes: [] }]
    const artifacts = new RuntimeArtifacts()

    artifacts.setNavigation(evaluation)
    artifacts.setStepFieldInventory(fieldInventory)

    // Act
    const result = projector.project(artifacts)

    // Assert
    expect(result.reachableSteps[0].backPath).toBeUndefined()
  })
})

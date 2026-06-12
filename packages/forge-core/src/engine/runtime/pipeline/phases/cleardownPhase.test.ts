import { createCleardownPhase } from './cleardownPhase'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type { NavigationEvaluation, NavigationStepState } from '../../../contracts/navigation/navigationEvaluation.type'
import type { NodeId } from '../../../contracts/ast/ast.type'

function createEvaluation(steps: Partial<NavigationStepState>[]): NavigationEvaluation {
  return {
    currentStepNodeId: undefined,
    steps: steps.map((step, declarationIndex) => ({
      stepNodeId: `compile_ast:${declarationIndex + 1}` as NodeId,
      routeTemplatePath: `/step-${declarationIndex + 1}`,
      declarationIndex,
      isEntryPoint: false,
      isConditionalEntry: false,
      hasValidation: false,
      isReachable: false,
      isValid: true,
      forwardRouteTemplatePaths: [],
      declaredForwardRouteTemplatePaths: [],
      predecessorRouteTemplatePaths: [],
      ...step,
    })),
    defaultEntryRouteTemplatePath: undefined,
    frontierRouteTemplatePath: undefined,
    canonicalPathRouteTemplatePaths: [],
    progressExists: false,
    resumeActive: false,
    resumeOutcome: 'no-op',
    unreachableRedirect: 'entry',
  }
}

describe('cleardownPhase', () => {
  describe('execute()', () => {
    it('should clear stale answers and store the resolved codes when a projection exists', async () => {
      // Arrange
      const phase = createCleardownPhase()
      const state = createPipelineState()

      state.context.global.answers = {
        fieldA: { current: 'value', mutations: [{ value: 'value', source: 'post' }] },
      }
      state.context.global.reachability = {
        reachableSteps: [{ path: '/step-1' }],
        unreachableSteps: [{ path: '/step-2', fieldCodes: ['fieldA'] }],
      }
      state.navigationEvaluation = createEvaluation([
        { routeTemplatePath: '/step-1', isEntryPoint: true, isReachable: true },
        { routeTemplatePath: '/step-2' },
      ])

      // Act
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.context.global.fieldsToClear).toEqual(['fieldA'])
      expect(state.context.global.answers.fieldA.current).toBeUndefined()
      expect(state.context.global.answers.fieldA.mutations).toEqual([
        { value: 'value', source: 'post' },
        { value: undefined, source: 'cleardown' },
      ])
    })

    it('should store an empty list and return continue when no reachability projection exists', async () => {
      // Arrange
      const phase = createCleardownPhase()
      const state = createPipelineState()

      // Act
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.context.global.fieldsToClear).toEqual([])
    })
  })
})

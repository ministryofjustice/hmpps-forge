import { createNavigationPhase } from './navigationPhase'
import TraceRecorder from '../trace/TraceRecorder'
import {
  createNavigationFixture,
  createNavigationValidationPlan,
  createPipelineState,
} from '../testing-helpers/navigationTestFixtures'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

const mockFunctionRegistry = {} as FunctionRegistry

describe('navigationPhase', () => {
  describe('execute()', () => {
    it('should return continue and store the evaluation when the current step is reachable', async () => {
      // Arrange
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: 'step-one', isEntryPoint: true },
      ])
      const phase = createNavigationPhase(
        plan,
        'compile_ast:1' as const,
        routeTemplateCatalog,
        'step-get',
        mockFunctionRegistry,
      )

      // Act
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.navigationEvaluation?.steps.map(step => step.isReachable)).toEqual([true])
      expect(state.validation).toBeUndefined()
      expect(state.showValidationFailures).toBeUndefined()
    })

    it('should return halt-redirect with reason unreachable when the current step is not reachable', async () => {
      // Arrange
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: 'step-one', isEntryPoint: true },
        { stepId: 'compile_ast:2' as const, path: 'step-two' },
      ])
      const phase = createNavigationPhase(
        plan,
        'compile_ast:2' as const,
        routeTemplateCatalog,
        'step-get',
        mockFunctionRegistry,
      )

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/journey/step-one', reason: 'unreachable' })
    })

    it('should return halt-redirect with reason resume when resume wants to move the user', async () => {
      // Arrange
      const { plan, routeTemplateCatalog } = createNavigationFixture(
        [
          {
            stepId: 'compile_ast:1' as const,
            path: 'step-one',
            isEntryPoint: true,
            hasValidation: true,
            evaluateOutcomes: vi.fn().mockReturnValue(['step-two']),
          },
          { stepId: 'compile_ast:2' as const, path: 'step-two', hasValidation: true },
        ],
        {
          resumeConfigured: true,
          resumeAlways: true,
          stepValidationPlans: new Map<NodeId, ValidationPlan>([
            ['compile_ast:1' as const, createNavigationValidationPlan(true)],
            ['compile_ast:2' as const, createNavigationValidationPlan(false)],
          ]),
        },
      )
      const phase = createNavigationPhase(
        plan,
        'compile_ast:1' as const,
        routeTemplateCatalog,
        'step-get',
        mockFunctionRegistry,
      )

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/journey/step-two', reason: 'resume' })
    })

    it('should store projected reachability on the context when params are present', async () => {
      // Arrange
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: 'step-one', isEntryPoint: true },
      ])
      const phase = createNavigationPhase(
        plan,
        'compile_ast:1' as const,
        routeTemplateCatalog,
        'step-get',
        mockFunctionRegistry,
      )

      // Act
      const state = createPipelineState()
      await phase.execute(state)

      // Assert
      expect(state.context.global.reachability).toBeDefined()
    })

    it('should record navigation-step and navigation-resolution units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: 'step-one', isEntryPoint: true },
        { stepId: 'compile_ast:2' as const, path: 'step-two' },
      ])
      const phase = createNavigationPhase(
        plan,
        'compile_ast:1' as const,
        routeTemplateCatalog,
        'step-get',
        mockFunctionRegistry,
      )

      recorder.beginPhase('navigation')

      // Act
      await phase.execute({ ...createPipelineState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        { kind: 'navigation-step', nodeId: 'compile_ast:1', isReachable: true, isValid: true },
        { kind: 'navigation-step', nodeId: 'compile_ast:2', isReachable: false, isValid: true },
        expect.objectContaining({ kind: 'navigation-resolution', resumeOutcome: 'no-op', redirect: undefined }),
      ])
    })

    it('should record the resolved redirect target on the navigation-resolution unit when redirecting', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: 'step-one', isEntryPoint: true },
        { stepId: 'compile_ast:2' as const, path: 'step-two' },
      ])
      const phase = createNavigationPhase(
        plan,
        'compile_ast:2' as const,
        routeTemplateCatalog,
        'step-get',
        mockFunctionRegistry,
      )

      recorder.beginPhase('navigation')

      // Act
      await phase.execute({ ...createPipelineState(), trace: recorder })
      recorder.endPhase('halt-redirect')

      // Assert
      const trace = recorder.finish('redirect')

      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'navigation-step', nodeId: 'compile_ast:1', isReachable: true }),
        expect.objectContaining({ kind: 'navigation-step', nodeId: 'compile_ast:2', isReachable: false }),
        expect.objectContaining({
          kind: 'navigation-resolution',
          resumeOutcome: 'no-op',
          redirect: '/journey/step-one',
        }),
      ])
    })
  })
})

import { createJourneyRedirectTerminal } from './journeyRedirectTerminal'
import TraceRecorder from '../trace/TraceRecorder'
import {
  createNavigationFixture,
  createNavigationPlan,
  createPipelineState,
  createRouteTemplateCatalog,
} from '../testing-helpers/navigationTestFixtures'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

const mockFunctionRegistry = {} as FunctionRegistry

describe('journeyRedirectTerminal', () => {
  describe('execute()', () => {
    it('should redirect to the resolved entry step', async () => {
      // Arrange
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: 'first-step', isEntryPoint: true },
      ])
      const terminal = createJourneyRedirectTerminal(plan, routeTemplateCatalog, mockFunctionRegistry)

      // Act
      const result = await terminal.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/journey/first-step' })
    })

    it('should interpolate path params in redirect target', async () => {
      // Arrange
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: ':personId/first-step', isEntryPoint: true },
      ])
      const terminal = createJourneyRedirectTerminal(plan, routeTemplateCatalog, mockFunctionRegistry)

      // Act
      const result = await terminal.execute(createPipelineState({ params: { personId: '42' } }))

      // Assert
      expect(result).toEqual({ type: 'redirect', url: '/journey/42/first-step' })
    })

    it('should throw when no steps are found', async () => {
      // Arrange
      const terminal = createJourneyRedirectTerminal(
        createNavigationPlan([]),
        createRouteTemplateCatalog([]),
        mockFunctionRegistry,
      )

      // Act & Assert
      await expect(terminal.execute(createPipelineState())).rejects.toThrow('No steps found in journey')
    })

    it('should record navigation units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const { plan, routeTemplateCatalog } = createNavigationFixture([
        { stepId: 'compile_ast:1' as const, path: 'first-step', isEntryPoint: true },
      ])
      const terminal = createJourneyRedirectTerminal(plan, routeTemplateCatalog, mockFunctionRegistry)

      recorder.beginPhase('journey-redirect')

      // Act
      await terminal.execute({ ...createPipelineState(), trace: recorder })
      recorder.endPhase('redirect')

      // Assert
      const trace = recorder.finish('redirect')

      expect(trace.phases[0].units).toEqual([
        { kind: 'navigation-step', nodeId: 'compile_ast:1', isReachable: true, isValid: true },
        expect.objectContaining({
          kind: 'navigation-resolution',
          resumeOutcome: 'no-op',
          redirect: '/journey/first-step',
        }),
      ])
    })
  })
})

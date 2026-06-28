import ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import type { CompilationPlan, StepCompilationInputs } from '../../contracts/plans/compilationPlan.type'
import type { NavigationRuntimePlan, ReachabilityCompilationPlan } from '../../contracts/plans/runtimePlans.type'
import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodegenOrchestrator from './CodegenOrchestrator'

describe('CodegenOrchestrator', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('compileAll()', () => {
    it('should attach compiled navigation to the shared navigation runtime plan', () => {
      // Arrange
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').build()
      const navigationPlan: NavigationRuntimePlan = {
        entries: [
          {
            stepId: stepNode.id,
            isEntryPoint: false,
          },
        ],
        resumeConfigured: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
      }
      const reachabilityPlan: ReachabilityCompilationPlan = {
        navigationPlan,
        entries: [
          {
            stepId: stepNode.id,
            isEntryPoint: false,
            forwardOutcomeGroups: [],
            cleardownFieldCodes: [],
            reachabilityTieBreakers: [],
          },
        ],
        resumeAlways: false,
      }
      const stepInputs: StepCompilationInputs = {
        core: {
          stepNode,
          runtimePlan: {
            stepId: stepNode.id,
            path: 'first',
          },
          staticData: { shared: 'step' },
          navigationId: journeyNode.id,
        },
        answerPreparation: {
          fieldBlocks: [],
          mapIterateNodes: [],
        },
        hooks: {
          accessHooks: [],
          submitHooks: [],
        },
        validation: {
          stepNode,
          validatingFieldBlocks: [],
          mapIterateNodes: [],
        },
        resolve: {
          stepNode,
          ancestorJourneys: [],
          allIterateNodes: [],
        },
      }
      const plan: CompilationPlan = {
        stepInputs: new Map([[stepNode.id, stepInputs]]),
        journeyInputs: new Map([
          [
            journeyNode.id,
            {
              runtimePlan: {
                journeyId: journeyNode.id,
                path: 'journey',
              },
              staticData: { shared: 'journey' },
              navigationPlan,
              stepFieldBlocks: [],
              stepMapIterateNodes: [],
              accessHooks: [],
            },
          ],
        ]),
        navigationInputs: new Map([
          [
            journeyNode.id,
            {
              navigationId: journeyNode.id,
              runtimePlan: navigationPlan,
              reachabilityPlan,
              fieldInventorySources: [],
            },
          ],
        ]),
      }
      const orchestrator = new CodegenOrchestrator({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const result = orchestrator.compileAll(plan, new ASTNodeIndex())

      // Assert
      expect(result.steps.get(stepNode.id)?.navigationPlan).toBe(navigationPlan)
      expect(result.journeys.get(journeyNode.id)?.navigationPlan).toBe(navigationPlan)
      expect(navigationPlan.compiledNavigation).toEqual(expect.any(Function))
      expect(result.steps.get(stepNode.id)?.compiledStaticData()).toEqual({ shared: 'step' })
      expect(result.journeys.get(journeyNode.id)?.compiledStaticData()).toEqual({ shared: 'journey' })
    })
  })
})

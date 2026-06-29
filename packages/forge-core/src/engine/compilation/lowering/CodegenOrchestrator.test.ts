import ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import type { CompilationPlan, StepCompilationInputs } from '../../contracts/plans/compilationPlan.type'
import type { ReachabilityStateTable, ReachabilityCompilationPlan } from '../../contracts/plans/runtimePlans.type'
import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodegenOrchestrator from './CodegenOrchestrator'

describe('CodegenOrchestrator', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('compileAll()', () => {
    it('should attach the compiled reachability functions to each step and journey', () => {
      // Arrange
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').build()
      const stateTable: ReachabilityStateTable = {
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
        stateTable,
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
          hasValidation: false,
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
              stateTable,
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
      expect(result.steps.get(stepNode.id)?.compiledReachabilityFacts).toEqual(expect.any(Function))
      expect(result.steps.get(stepNode.id)?.compiledReachabilityState).toEqual(expect.any(Function))
      expect(result.journeys.get(journeyNode.id)?.compiledReachabilityFacts).toEqual(expect.any(Function))
      expect(result.journeys.get(journeyNode.id)?.compiledReachabilityState).toEqual(expect.any(Function))
      expect(result.steps.get(stepNode.id)?.compiledStaticData()).toEqual({ shared: 'step' })
      expect(result.journeys.get(journeyNode.id)?.compiledStaticData()).toEqual({ shared: 'journey' })
    })
  })
})

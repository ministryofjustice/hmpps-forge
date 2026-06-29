import { BlockType } from '../../../authoring/types/enums'
import ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import type { NodeId } from '../../contracts/ast/engine.type'
import type { CompilationPlan, StepCompilationInputs } from '../../contracts/plans/compilationPlan.type'
import type { ReachabilityStateTable, ReachabilityCompilationPlan } from '../../contracts/plans/runtimePlans.type'
import type { FieldBlockASTNode, StepASTNode } from '../../contracts/ast/structures.type'
import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CodegenOrchestrator from './CodegenOrchestrator'

describe('CodegenOrchestrator', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('compileAll()', () => {
    it('should assemble required compiled functions and journey-scoped validation maps', () => {
      // Arrange
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').build()
      const validatingStepNode = ASTTestFactory.step().withPath('/second').build()
      const validatingFieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('name')
        .withProperty('validWhen', [{ message: 'Enter your name' }])
        .build() as FieldBlockASTNode
      const stateTable: ReachabilityStateTable = {
        entries: [
          {
            stepId: stepNode.id,
            isEntryPoint: false,
          },
          {
            stepId: validatingStepNode.id,
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
          {
            stepId: validatingStepNode.id,
            isEntryPoint: false,
            forwardOutcomeGroups: [],
            cleardownFieldCodes: [],
            reachabilityTieBreakers: [],
          },
        ],
        resumeAlways: false,
      }
      const plan: CompilationPlan = {
        stepInputs: new Map([
          [
            stepNode.id,
            createStepInputs({
              stepNode,
              journeyId: journeyNode.id,
              staticData: { shared: 'step' },
            }),
          ],
          [
            validatingStepNode.id,
            createStepInputs({
              stepNode: validatingStepNode,
              journeyId: journeyNode.id,
              staticData: { shared: 'validating-step' },
              validatingFieldBlocks: [validatingFieldBlock],
            }),
          ],
        ]),
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
        reachabilityInputs: new Map([
          [
            journeyNode.id,
            {
              reachabilityId: journeyNode.id,
              stateTable,
              reachabilityPlan,
              fieldInventorySources: [],
            },
          ],
        ]),
        routeMetadataInputs: new Map(),
      }
      const orchestrator = new CodegenOrchestrator({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const result = orchestrator.compileAll(plan, new ASTNodeIndex())

      // Assert
      const compiledStep = result.steps.get(stepNode.id)
      const compiledValidatingStep = result.steps.get(validatingStepNode.id)
      const compiledJourney = result.journeys.get(journeyNode.id)

      expect(compiledStep?.compiledReachabilityFacts).toEqual(expect.any(Function))
      expect(compiledStep?.compiledReachabilityState).toEqual(expect.any(Function))
      expect(compiledStep?.compiledStaticData).toEqual(expect.any(Function))
      expect(compiledStep?.compiledAccessLifecycle).toEqual(expect.any(Function))
      expect(compiledStep?.compiledSubmitHooks).toEqual(expect.any(Function))
      expect(compiledStep?.compiledAnswerPreparation).toEqual(expect.any(Function))
      expect(compiledStep?.compiledValidation).toEqual(expect.any(Function))
      expect(compiledStep?.compiledEntryValidation).toEqual(expect.any(Function))
      expect(compiledStep?.compiledResolve).toEqual(expect.any(Function))
      expect(compiledJourney?.compiledReachabilityFacts).toEqual(expect.any(Function))
      expect(compiledJourney?.compiledReachabilityState).toEqual(expect.any(Function))
      expect(compiledJourney?.compiledStaticData).toEqual(expect.any(Function))
      expect(compiledJourney?.compiledAccessLifecycle).toEqual(expect.any(Function))
      expect(compiledJourney?.compiledAnswerPreparation).toEqual(expect.any(Function))
      expect(compiledStep?.compiledRouteMetadata).toEqual(expect.any(Function))
      expect(compiledJourney?.compiledRouteMetadata).toEqual(expect.any(Function))
      expect(compiledStep?.compiledRouteMetadata).toBe(compiledJourney?.compiledRouteMetadata)
      expect(compiledStep?.compiledStaticData()).toEqual({ shared: 'step' })
      expect(compiledValidatingStep?.compiledStaticData()).toEqual({ shared: 'validating-step' })
      expect(compiledJourney?.compiledStaticData()).toEqual({ shared: 'journey' })
      expect([...Array.from(compiledStep?.compiledStepValidations.keys() ?? [])]).toEqual([validatingStepNode.id])
      expect([...Array.from(compiledValidatingStep?.compiledStepValidations.keys() ?? [])]).toEqual([
        validatingStepNode.id,
      ])
      expect([...Array.from(compiledJourney?.compiledStepValidations.keys() ?? [])]).toEqual([validatingStepNode.id])
    })
  })
})

function createStepInputs({
  stepNode,
  journeyId,
  staticData,
  validatingFieldBlocks = [],
}: {
  readonly stepNode: StepASTNode
  readonly journeyId: NodeId
  readonly staticData: Record<string, unknown>
  readonly validatingFieldBlocks?: FieldBlockASTNode[]
}): StepCompilationInputs {
  return {
    core: {
      stepNode,
      runtimePlan: {
        stepId: stepNode.id,
        path: stepNode.properties.path,
      },
      staticData,
      reachabilityId: journeyId,
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
      hasValidation: validatingFieldBlocks.length > 0,
      validatingFieldBlocks,
      mapIterateNodes: [],
    },
    resolve: {
      stepNode,
      ancestorJourneys: [],
      allIterateNodes: [],
    },
  }
}

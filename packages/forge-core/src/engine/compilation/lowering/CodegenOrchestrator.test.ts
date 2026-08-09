import { BlockType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import type { CompilationPlan, StepCompilationInputs } from '../../contracts/plans/compilationPlan.type'
import type { ReachabilityStateTable, ReachabilityCompilationPlan } from '../../contracts/plans/runtimePlans.type'
import type { FieldBlockASTNode, StepASTNode } from '../../contracts/ast/structures.type'
import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import CompilationTracer from '../tracing/CompilationTracer'
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
              staticData: { shared: 'step' },
            }),
          ],
          [
            validatingStepNode.id,
            createStepInputs({
              stepNode: validatingStepNode,
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
              answerCleardown: { fieldInventorySources: [] },
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
      const result = orchestrator.compileAll(plan)

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

    it('should skip journey-scoped validation maps when reachability checks are disabled', () => {
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
        unreachableRedirect: 'entry',
        reachabilityDisabled: true,
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
              staticData: { shared: 'step' },
            }),
          ],
          [
            validatingStepNode.id,
            createStepInputs({
              stepNode: validatingStepNode,
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
              answerCleardown: { fieldInventorySources: [] },
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
      const result = orchestrator.compileAll(plan)

      // Assert
      const compiledStep = result.steps.get(stepNode.id)
      const compiledValidatingStep = result.steps.get(validatingStepNode.id)
      const compiledJourney = result.journeys.get(journeyNode.id)

      expect(compiledValidatingStep?.compiledValidation).toEqual(expect.any(Function))
      expect([...Array.from(compiledStep?.compiledStepValidations.keys() ?? [])]).toEqual([])
      expect([...Array.from(compiledValidatingStep?.compiledStepValidations.keys() ?? [])]).toEqual([])
      expect([...Array.from(compiledJourney?.compiledStepValidations.keys() ?? [])]).toEqual([])
    })

    it('should record nested codegen spans for package, journey, step, and function work when tracing', () => {
      // Arrange
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').build()
      const stateTable: ReachabilityStateTable = {
        entries: [{ stepId: stepNode.id, isEntryPoint: false }],
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
      const plan: CompilationPlan = {
        stepInputs: new Map([[stepNode.id, createStepInputs({ stepNode, staticData: { shared: 'step' } })]]),
        journeyInputs: new Map([
          [
            journeyNode.id,
            {
              runtimePlan: { journeyId: journeyNode.id, path: 'journey' },
              staticData: { shared: 'journey' },
              stepFieldBlocks: [],
              stepMapIterateNodes: [],
              accessHooks: [],
              answerCleardown: { fieldInventorySources: [] },
            },
          ],
        ]),
        reachabilityInputs: new Map([
          [journeyNode.id, { reachabilityId: journeyNode.id, stateTable, reachabilityPlan }],
        ]),
        routeMetadataInputs: new Map(),
      }
      const tracer = new CompilationTracer({ enabled: true })
      const orchestrator = new CodegenOrchestrator({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
        tracer,
      })

      // Act
      orchestrator.compileAll(plan)

      // Assert
      const root = tracer.root
      const packageFunctionsSpan = root?.children.find(child => child.kind === 'codegen.package-functions')
      const journeySpan = root?.children.find(child => child.kind === 'codegen.journey')
      const stepSpan = journeySpan?.children.find(child => child.kind === 'codegen.step')
      const stepFunctionSpans = stepSpan?.children.filter(child => child.kind === 'codegen.function') ?? []

      expect(packageFunctionsSpan?.key).toBe('package-functions')
      expect(journeySpan?.key).toBe(`journey:${journeyNode.id}`)
      expect(journeySpan?.beginFields).toEqual({ nodeId: journeyNode.id })
      expect(stepSpan?.key).toBe(`step:${stepNode.id}`)
      expect(stepSpan?.beginFields).toEqual({ nodeId: stepNode.id })
      expect(stepFunctionSpans.length).toBeGreaterThan(0)
    })
  })
})

function createStepInputs({
  stepNode,
  staticData,
  validatingFieldBlocks = [],
}: {
  readonly stepNode: StepASTNode
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

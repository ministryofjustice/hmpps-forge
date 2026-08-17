import { BlockType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import type { CompilationModel, JourneyModel, StepModel } from '../../contracts/models/compilationModel.type'
import type { ReachabilityModel } from '../../concerns/reachability/contracts/reachabilityModel.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../../contracts/ast/structures.type'
import { buildStepFieldModels } from '../analysis/testing-helpers/analysisContexts'
import ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import CompilationModelBuilder from '../analysis/CompilationModelBuilder'
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
      const model = createCompilationModel([
        createJourneyModel({
          journeyNode,
          steps: [
            createStepModel({ stepNode, staticData: { shared: 'step' } }),
            createStepModel({
              stepNode: validatingStepNode,
              staticData: { shared: 'validating-step' },
              validatingFieldBlocks: [validatingFieldBlock],
            }),
          ],
          staticData: { shared: 'journey' },
        }),
      ])
      const orchestrator = new CodegenOrchestrator({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const result = orchestrator.compileAll(model)

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
      expect(compiledValidatingStep?.compiledValidation).toBe(
        compiledJourney?.compiledStepValidations.get(validatingStepNode.id),
      )
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
      const model = createCompilationModel([
        createJourneyModel({
          journeyNode,
          steps: [
            createStepModel({ stepNode, staticData: { shared: 'step' } }),
            createStepModel({
              stepNode: validatingStepNode,
              staticData: { shared: 'validating-step' },
              validatingFieldBlocks: [validatingFieldBlock],
            }),
          ],
          staticData: { shared: 'journey' },
          reachabilityDisabled: true,
        }),
      ])
      const orchestrator = new CodegenOrchestrator({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const result = orchestrator.compileAll(model)

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
      const model = createCompilationModel([
        createJourneyModel({
          journeyNode,
          steps: [createStepModel({ stepNode, staticData: { shared: 'step' } })],
          staticData: { shared: 'journey' },
        }),
      ])
      const tracer = new CompilationTracer({ enabled: true })
      const orchestrator = new CodegenOrchestrator({
        functionRegistry: new FunctionRegistry(),
        componentRegistry: new ComponentRegistry(),
        tracer,
      })

      // Act
      orchestrator.compileAll(model)

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

    it('should compile a model built by the real builder without missing inputs', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').withCode('first').build()

      Object.defineProperty(stepNode, 'parent', { value: journeyNode, enumerable: false })
      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)

      const registries = {
        componentRegistry: new ComponentRegistry(),
        functionRegistry: new FunctionRegistry(),
      }
      const model = new CompilationModelBuilder(nodeRegistry, registries).build(new Map([[stepNode.id, stepNode]]))
      const orchestrator = new CodegenOrchestrator(registries)

      // Act
      const result = orchestrator.compileAll(model)

      // Assert
      expect(result.steps.get(stepNode.id)?.compiledResolve).toEqual(expect.any(Function))
      expect(result.journeys.get(journeyNode.id)?.compiledReachabilityFacts).toEqual(expect.any(Function))
    })
  })
})

function createStepModel({
  stepNode,
  staticData,
  validatingFieldBlocks = [],
}: {
  readonly stepNode: StepASTNode
  readonly staticData: Record<string, unknown>
  readonly validatingFieldBlocks?: FieldBlockASTNode[]
}): StepModel {
  return {
    stepId: stepNode.id,
    label: undefined,
    mountInfo: {
      stepId: stepNode.id,
      path: stepNode.properties.path,
    },
    staticData,
    fields: [],
    answerPreparation: {
      label: undefined,
      fields: [],
    },
    hooks: {
      access: { label: undefined, hooks: [] },
      submit: { label: undefined, hooks: [] },
    },
    validation: {
      label: undefined,
      hasValidation: validatingFieldBlocks.length > 0,
      fields: buildStepFieldModels({ fieldBlocks: validatingFieldBlocks }).filter(
        field => field.validation !== undefined,
      ),
      domainRules: undefined,
      entryValidation: [],
    },
    resolve: {
      label: undefined,
      step: [],
      ancestors: [],
      blocks: [],
      standaloneIterateBlocks: [],
    },
  }
}

function createJourneyModel({
  journeyNode,
  steps,
  staticData,
  reachabilityDisabled = false,
}: {
  readonly journeyNode: JourneyASTNode
  readonly steps: readonly StepModel[]
  readonly staticData: Record<string, unknown>
  readonly reachabilityDisabled?: boolean
}): JourneyModel {
  const reachability: ReachabilityModel = {
    label: undefined,
    stateTable: {
      entries: steps.map(step => ({ stepId: step.stepId, isEntryPoint: false })),
      unreachableRedirect: 'entry',
      reachabilityDisabled,
    },
    entries: steps.map(step => ({
      stepId: step.stepId,
      isEntryPoint: false,
      forwardOutcomeGroups: [],
      cleardownFieldCodes: [],
      reachabilityTieBreakers: [],
    })),
    resumeAlways: false,
  }

  return {
    journeyId: journeyNode.id,
    label: undefined,
    mountInfo: {
      journeyId: journeyNode.id,
      path: 'journey',
    },
    staticData,
    hooks: { access: { label: undefined, hooks: [] } },
    reachability,
    cleardown: { label: undefined, steps: [] },
    answerPreparation: { label: undefined, fields: [] },
    steps: new Map(steps.map(step => [step.stepId, step])),
  }
}

function createCompilationModel(journeys: readonly JourneyModel[]): CompilationModel {
  return {
    routeMetadata: new Map(),
    journeys: new Map(journeys.map(journey => [journey.journeyId, journey])),
  }
}

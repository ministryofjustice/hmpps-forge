import type { JourneyDefinition } from '../authoring/types/structures.type'
import { StructureType } from '../authoring/types/enums'
import type { JourneyASTNode, StepASTNode } from './types/structures.type'
import type { JourneyInstanceDependencies, NodeId } from './types/engine.type'
import type { CompilationDependencies } from './compilation/CompilationDependencies'
import type RuntimePlanBuilder from './compilation/RuntimePlanBuilder'
import type { ReachabilityRuntimePlan, StepRuntimePlan } from './compilation/RuntimePlanBuilder'
import type { SharedCompiledForm } from './compilation/CompilationFactory'
import type { CompiledValidationFunction } from './compilation/validation/StepValidationCompiler'
import CompilationFactory from './compilation/CompilationFactory'
import JourneyInstance from './JourneyInstance'

describe('JourneyInstance', () => {
  describe('compileAllRouteArtefacts()', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should eagerly compile step, journey, and reachability validation artefacts', () => {
      // Arrange
      const stepOneId = 'compile_ast:1'
      const stepTwoId = 'compile_ast:2'
      const resolveStepValidations = vi.fn(() => new Map<NodeId, CompiledValidationFunction>())
      const reachabilityPlan = createReachabilityPlan(resolveStepValidations)
      const sharedCompilation = createSharedCompilation(stepOneId, stepTwoId, reachabilityPlan)
      const compileSharedSpy = vi.spyOn(CompilationFactory.prototype, 'compileShared')
        .mockReturnValue(sharedCompilation)
      const compileStepSpy = vi.spyOn(CompilationFactory.prototype, 'compileStep')
        .mockReturnValue(createCompiledStep())
      const compileJourneySpy = vi.spyOn(CompilationFactory.prototype, 'compileJourney')
        .mockReturnValue({} as CompilationDependencies)
      const journey = JourneyInstance.createFromConfiguration(createJourneyDefinition(), createDependencies())

      // Act
      journey.compileAllRouteArtefacts()

      // Assert
      expect(compileSharedSpy).toHaveBeenCalledTimes(1)
      expect(compileStepSpy).toHaveBeenCalledTimes(2)
      expect(compileStepSpy).toHaveBeenCalledWith(sharedCompilation, stepOneId)
      expect(compileStepSpy).toHaveBeenCalledWith(sharedCompilation, stepTwoId)
      expect(compileJourneySpy).toHaveBeenCalledTimes(1)
      expect(compileJourneySpy).toHaveBeenCalledWith(sharedCompilation)
      expect(resolveStepValidations).toHaveBeenCalledTimes(1)
    })
  })
})

function createJourneyDefinition(): JourneyDefinition {
  return {
    type: StructureType.JOURNEY,
    path: '/journey',
    code: 'journey',
    title: 'Journey',
    steps: [],
  }
}

function createDependencies(): JourneyInstanceDependencies {
  return {
    componentRegistry: {},
    frameworkAdapter: {},
    functionRegistry: {},
    logger: console,
  } as JourneyInstanceDependencies
}

function createSharedCompilation(
  stepOneId: NodeId,
  stepTwoId: NodeId,
  reachabilityPlan: ReachabilityRuntimePlan,
): SharedCompiledForm {
  return {
    rootNode: { properties: { code: 'journey' } } as JourneyASTNode,
    sharedDependencies: {} as CompilationDependencies,
    stepIndex: new Map<NodeId, StepASTNode>([
      [stepOneId, { id: stepOneId } as StepASTNode],
      [stepTwoId, { id: stepTwoId } as StepASTNode],
    ]),
    journeyIndex: new Map(),
    reachabilityPlans: new Map([
      [stepOneId, reachabilityPlan],
      [stepTwoId, reachabilityPlan],
    ]),
    journeyRuntimePlans: new Map(),
    planBuilder: {} as RuntimePlanBuilder,
  }
}

function createReachabilityPlan(
  resolveStepValidations: () => Map<NodeId, CompiledValidationFunction>,
): ReachabilityRuntimePlan {
  return {
    entries: [],
    resumeAlways: false,
    reachabilityDisabled: false,
    resolveStepValidations,
  }
}

function createCompiledStep(): ReturnType<CompilationFactory['compileStep']> {
  return {
    artefact: {} as CompilationDependencies,
    compiledAnswerPreparation: undefined,
    compiledEntryValidation: undefined,
    compiledRender: undefined,
    compiledValidation: undefined,
    currentStepId: 'compile_ast:3',
    runtimePlan: createStepRuntimePlan('compile_ast:3'),
  }
}

function createStepRuntimePlan(stepId: NodeId): StepRuntimePlan {
  return {
    stepId,
    path: '/step',
    accessAncestorIds: [],
    submitHookIds: [],
    iterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    renderAncestorIds: [],
    renderStepId: stepId,
    hasValidatingSubmitHook: false,
    hasDomainValidation: false,
  }
}

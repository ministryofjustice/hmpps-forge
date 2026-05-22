import type { JourneyDefinition } from '../authoring/types/structures.type'
import { StructureType } from '../authoring/types/enums'
import type { JourneyASTNode, StepASTNode } from './types/structures.type'
import type { JourneyInstanceDependencies, NodeId } from './types/engine.type'
import type { CompilationContext } from './compilation/CompilationContext'
import type { NavigationRuntimePlan, StepRuntimePlan } from './types/runtimePlans.type'
import type { SharedCompiledForm } from './types/compilationArtefacts.type'
import CompilationFactory from './compilation/CompilationFactory'
import JourneyInstance from './JourneyInstance'

describe('JourneyInstance', () => {
  describe('compileAllRouteArtefacts()', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should eagerly compile step and journey artefacts', () => {
      // Arrange
      const stepOneId = 'compile_ast:1'
      const stepTwoId = 'compile_ast:2'
      const navigationPlan = createNavigationPlan()
      const sharedCompilation = createSharedCompilation(stepOneId, stepTwoId, navigationPlan)
      const compileSharedSpy = vi.spyOn(CompilationFactory.prototype, 'compileShared')
        .mockReturnValue(sharedCompilation)
      const compileStepSpy = vi.spyOn(CompilationFactory.prototype, 'compileStep')
        .mockReturnValue(createCompiledStep())
      const compileJourneySpy = vi.spyOn(CompilationFactory.prototype, 'compileJourney')
        .mockReturnValue({} as CompilationContext)
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
  navigationPlan: NavigationRuntimePlan,
): SharedCompiledForm {
  return {
    rootNode: { properties: { code: 'journey' } } as JourneyASTNode,
    sharedContext: {} as CompilationContext,
    stepIndex: new Map<NodeId, StepASTNode>([
      [stepOneId, { id: stepOneId } as StepASTNode],
      [stepTwoId, { id: stepTwoId } as StepASTNode],
    ]),
    journeyIndex: new Map(),
    stepRuntimePlans: new Map([
      [stepOneId, createStepRuntimePlan(stepOneId)],
      [stepTwoId, createStepRuntimePlan(stepTwoId)],
    ]),
    navigationPlans: new Map([
      [stepOneId, navigationPlan],
      [stepTwoId, navigationPlan],
    ]),
    reachabilityCompilationPlans: [],
    journeyRuntimePlans: new Map(),
  }
}

function createNavigationPlan(): NavigationRuntimePlan {
  return {
    entries: [],
    resumeConfigured: false,
    unreachableRedirect: 'entry',
    reachabilityDisabled: false,
    compiledStepValidations: new Map(),
  }
}

function createCompiledStep(): ReturnType<CompilationFactory['compileStep']> {
  return {
    compiledAnswerPreparation: undefined,
    compiledEntryValidation: undefined,
    compiledRender: undefined,
    compiledValidation: undefined,
    navigationPlan: createNavigationPlan(),
    runtimePlan: createStepRuntimePlan('compile_ast:3'),
  }
}

function createStepRuntimePlan(stepId: NodeId): StepRuntimePlan {
  return {
    stepId,
    path: '/step',
    staticData: {},
  }
}

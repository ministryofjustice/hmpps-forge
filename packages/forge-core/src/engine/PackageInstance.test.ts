import { buildComponent } from '../components/utils/buildComponent'
import { StructureType } from '../authoring/types/enums'
import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { JourneyASTNode, StepASTNode } from './types/structures.type'
import type { NodeId } from './types/engine.type'
import type { CompilationContext } from './compilation/CompilationContext'
import type { NavigationRuntimePlan, StepRuntimePlan } from './types/runtimePlans.type'
import type { SharedCompiledForm } from './types/compilationArtefacts.type'
import CompilationFactory from './compilation/CompilationFactory'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import ScopedComponentRegistry from './registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './registries/ScopedFunctionRegistry'
import PackageInstance from './PackageInstance'

describe('PackageInstance', () => {
  describe('create()', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('should use global dependencies when package has no scoped registrations', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()

      mockCompilation()

      // Act
      const instance = PackageInstance.create(
        { journey: createJourneyDefinition() },
        { functionRegistry, componentRegistry },
      )

      // Assert
      expect(instance.getDependencies().functionRegistry).toBe(functionRegistry)
      expect(instance.getDependencies().componentRegistry).toBe(componentRegistry)
    })

    it('should scope package functions with provided dependencies', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()

      functionRegistry.register({
        GlobalFunction: {
          name: 'GlobalFunction',
          evaluate: () => true,
          isAsync: false,
        },
      })
      mockCompilation()

      // Act
      const instance = PackageInstance.create(
        {
          journey: createJourneyDefinition(),
          functions: {
            WithPrefix: (deps: { prefix: string }) => (value: unknown) => `${deps.prefix}${String(value)}`,
          },
        },
        {
          functionRegistry,
          componentRegistry,
          functionDependencies: { prefix: 'case-' },
        },
      )

      // Assert
      const scopedFunctionRegistry = instance.getDependencies().functionRegistry
      const packageFunction = scopedFunctionRegistry.get('WithPrefix')

      expect(scopedFunctionRegistry).toBeInstanceOf(ScopedFunctionRegistry)
      expect(scopedFunctionRegistry.has('GlobalFunction')).toBe(true)
      expect(packageFunction?.evaluate('123')).toBe('case-123')
      expect(functionRegistry.has('WithPrefix')).toBe(false)
    })

    it('should scope package components without registering them globally', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const componentRegistry = new ComponentRegistry()
      const globalComponent = buildComponent('global-component', () => '<div>Global</div>')
      const packageComponent = buildComponent('package-component', () => '<div>Package</div>')

      componentRegistry.registerMany([globalComponent])
      mockCompilation()

      // Act
      const instance = PackageInstance.create(
        {
          journey: createJourneyDefinition(),
          components: [packageComponent],
        },
        { functionRegistry, componentRegistry },
      )

      // Assert
      const scopedComponentRegistry = instance.getDependencies().componentRegistry

      expect(scopedComponentRegistry).toBeInstanceOf(ScopedComponentRegistry)
      expect(scopedComponentRegistry.get('global-component')).toBe(globalComponent)
      expect(scopedComponentRegistry.get('package-component')).toBe(packageComponent)
      expect(componentRegistry.has('package-component')).toBe(false)
    })
  })

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
      const packageInstance = PackageInstance.create(
        { journey: createJourneyDefinition() },
        {
          componentRegistry: new ComponentRegistry(),
          functionRegistry: new FunctionRegistry(),
        },
      )

      // Act
      packageInstance.compileAllRouteArtefacts()

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

function mockCompilation(): void {
  const navigationPlan = createNavigationPlan()

  vi.spyOn(CompilationFactory.prototype, 'compileShared')
    .mockReturnValue(createSharedCompilation('compile_ast:1', 'compile_ast:2', navigationPlan))
}

function createJourneyDefinition(): JourneyDefinition {
  return {
    type: StructureType.JOURNEY,
    path: '/journey',
    code: 'journey',
    title: 'Journey',
    steps: [],
  }
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

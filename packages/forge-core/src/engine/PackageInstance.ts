import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { ForgePackageRegistration, PackageDependencies, NodeId } from './types/engine.type'
import { DSLValidator } from './validation/DSLValidator'
import { createFunctionsRegistry } from '../authoring/utils/createFunctionsRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import ScopedComponentRegistry from './registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './registries/ScopedFunctionRegistry'
import CompilationFactory from './compilation/CompilationFactory'
import type {
  CompilationArtefact,
  CompiledForm,
  CompiledStep,
  JourneyIndex,
  SharedCompiledForm,
  StepIndex,
} from './types/compilationArtefacts.type'
import type { JourneyRuntimePlan } from './types/runtimePlans.type'

interface PackageInstanceOptions<TDeps> {
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly functionDependencies?: TDeps
}

/**
 * Contains package-scoped dependencies and compiled metadata for the package root journey.
 */
export default class PackageInstance {
  private readonly dependencies: PackageDependencies

  private readonly compiler: CompilationFactory

  private readonly sharedCompilation: SharedCompiledForm

  private readonly stepCache = new Map<NodeId, CompiledStep>()

  private journeyArtefact?: CompilationArtefact

  private readonly rawConfiguration: JourneyDefinition

  private constructor(packageConfiguration: JourneyDefinition, packageDependencies: PackageDependencies) {
    this.dependencies = packageDependencies
    this.rawConfiguration = packageConfiguration
    this.compiler = new CompilationFactory(packageDependencies.functionRegistry)
    this.sharedCompilation = this.compiler.compileShared(packageConfiguration)
  }

  static create<TDeps>(pkg: ForgePackageRegistration<TDeps>, options: PackageInstanceOptions<TDeps>): PackageInstance {
    const packageDependencies: PackageDependencies = {
      functionRegistry: this.resolveFunctionRegistry(pkg, options),
      componentRegistry: this.resolveComponentRegistry(pkg, options.componentRegistry),
    }
    const packageConfiguration = this.loadConfiguration(pkg.journey)

    DSLValidator.validateTree(
      packageConfiguration,
      packageDependencies.functionRegistry,
      packageDependencies.componentRegistry,
    )

    return new PackageInstance(packageConfiguration, packageDependencies)
  }

  getDependencies(): PackageDependencies {
    return this.dependencies
  }

  compileAllRouteArtefacts(): void {
    this.sharedCompilation.stepIndex.forEach((_, stepId) => {
      this.getOrCompileStep(stepId)
    })

    this.getJourneyCompilationArtefact()
  }

  getCompiledForm(): CompiledForm {
    return [...this.sharedCompilation.stepIndex.keys()].map(stepId => this.getOrCompileStep(stepId))
  }

  getCompiledStep(stepId: NodeId): CompiledStep {
    return this.getOrCompileStep(stepId)
  }

  getStepIndex(): StepIndex {
    return new Map(this.sharedCompilation.stepIndex)
  }

  getJourneyIndex(): JourneyIndex {
    return new Map(this.sharedCompilation.journeyIndex)
  }

  getJourneyRuntimePlan(journeyId: NodeId): JourneyRuntimePlan | undefined {
    return this.sharedCompilation.journeyRuntimePlans.get(journeyId)
  }

  getSharedCompilationArtefact(): CompilationArtefact {
    return this.sharedCompilation.sharedContext
  }

  getJourneyCompilationArtefact(): CompilationArtefact {
    if (!this.journeyArtefact) {
      this.journeyArtefact = this.compiler.compileJourney(this.sharedCompilation)
    }

    return this.journeyArtefact
  }

  getConfiguration(): JourneyDefinition {
    return this.rawConfiguration
  }

  getJourneyCode(): string {
    const journeyNode = this.sharedCompilation.rootNode

    if (!journeyNode) {
      throw new Error('No journey node found in compiled journey')
    }

    return journeyNode.properties.code
  }

  getJourneyTitle(): string {
    return this.rawConfiguration.title
  }

  private static loadConfiguration(configuration: string | JourneyDefinition): JourneyDefinition {
    const parsedConfiguration: unknown = typeof configuration === 'string' ? JSON.parse(configuration) : configuration

    DSLValidator.validateJSON(parsedConfiguration)
    DSLValidator.validateSchema(parsedConfiguration)

    return parsedConfiguration
  }

  private static resolveFunctionRegistry<TDeps>(
    pkg: ForgePackageRegistration<TDeps>,
    options: PackageInstanceOptions<TDeps>,
  ): FunctionRegistry {
    if (!pkg.functions) {
      return options.functionRegistry
    }

    const resolvedDeps = (options.functionDependencies ?? {}) as TDeps
    const scopedFunctionRegistry = new ScopedFunctionRegistry(options.functionRegistry)

    scopedFunctionRegistry.register(createFunctionsRegistry(pkg.functions, resolvedDeps))

    return scopedFunctionRegistry
  }

  private static resolveComponentRegistry<TDeps>(
    pkg: ForgePackageRegistration<TDeps>,
    componentRegistry: ComponentRegistry,
  ): ComponentRegistry {
    if (!pkg.components) {
      return componentRegistry
    }

    const scopedComponentRegistry = new ScopedComponentRegistry(componentRegistry)

    scopedComponentRegistry.registerMany(pkg.components)

    return scopedComponentRegistry
  }

  private getOrCompileStep(stepId: NodeId): CompiledStep {
    const cachedStep = this.stepCache.get(stepId)

    if (cachedStep) {
      return cachedStep
    }

    const partial = this.compiler.compileStep(this.sharedCompilation, stepId)
    const navigationPlan = this.sharedCompilation.navigationPlans.get(stepId)!

    const compiledStep: CompiledStep = { ...partial, navigationPlan }

    this.stepCache.set(stepId, compiledStep)

    return compiledStep
  }
}

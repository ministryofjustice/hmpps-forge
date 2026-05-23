import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { ForgePackageRegistration, PackageDependencies, NodeId } from './types/engine.type'
import { DSLValidator } from './validation/DSLValidator'
import { createFunctionsRegistry } from '../authoring/utils/createFunctionsRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import ScopedComponentRegistry from './registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './registries/ScopedFunctionRegistry'
import JourneyCompiler, { type JourneyCompilationResult } from './compilation/JourneyCompiler'
import type { CompilationContext } from './compilation/CompilationContext'
import type { CompiledStep, JourneyIndex, StepIndex } from './types/compilationArtefacts.type'
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

  private readonly compilation: JourneyCompilationResult

  private readonly rawConfiguration: JourneyDefinition

  private constructor(packageConfiguration: JourneyDefinition, packageDependencies: PackageDependencies) {
    this.dependencies = packageDependencies
    this.rawConfiguration = packageConfiguration
    const compiler = new JourneyCompiler({ functionRegistry: packageDependencies.functionRegistry })
    this.compilation = compiler.compile(packageConfiguration)
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

  getCompiledStep(stepId: NodeId): CompiledStep {
    const step = this.compilation.steps.get(stepId)

    if (!step) {
      throw new Error(`Step "${stepId}" not found in compiled journey`)
    }

    return step
  }

  getStepIndex(): StepIndex {
    return new Map(this.compilation.stepIndex)
  }

  getJourneyIndex(): JourneyIndex {
    return new Map(this.compilation.journeyIndex)
  }

  getJourneyRuntimePlan(journeyId: NodeId): JourneyRuntimePlan | undefined {
    return this.compilation.journeyPlans.get(journeyId)
  }

  getCompilationContext(): CompilationContext {
    return this.compilation.context
  }

  getConfiguration(): JourneyDefinition {
    return this.rawConfiguration
  }

  getJourneyCode(): string {
    return this.compilation.rootNode.properties.code
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

}

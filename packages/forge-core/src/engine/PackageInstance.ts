import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { ForgePackageRegistration, PackageDependencies, NodeId } from './types/engine.type'
import { DSLValidator } from './validation/DSLValidator'
import { createFunctionsRegistry } from '../authoring/utils/createFunctionsRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import ScopedComponentRegistry from './registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './registries/ScopedFunctionRegistry'
import JourneyCompiler from './compilation/JourneyCompiler'
import type { CompilationContext } from './compilation/CompilationContext'
import type { CompiledStep, JourneyCompilationResult, JourneyIndex, StepIndex } from './types/compilationArtefacts.type'
import type { JourneyRuntimePlan } from './types/runtimePlans.type'

export interface PackageInstanceOptions<TDeps> {
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly functionDependencies?: TDeps
}

export default class PackageInstance {
  private readonly dependencies: PackageDependencies

  private readonly compilation: JourneyCompilationResult

  private readonly rawConfiguration: JourneyDefinition

  constructor(pkg: ForgePackageRegistration<any>, options: PackageInstanceOptions<any>) {
    this.dependencies = {
      functionRegistry: PackageInstance.resolveFunctionRegistry(pkg, options),
      componentRegistry: PackageInstance.resolveComponentRegistry(pkg, options.componentRegistry),
    }

    this.rawConfiguration = PackageInstance.loadConfiguration(pkg.journey)

    DSLValidator.validateTree(
      this.rawConfiguration,
      this.dependencies.functionRegistry,
      this.dependencies.componentRegistry,
    )

    const compiler = new JourneyCompiler({ functionRegistry: this.dependencies.functionRegistry })

    this.compilation = compiler.compile(this.rawConfiguration)
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

  private static resolveFunctionRegistry(
    pkg: ForgePackageRegistration<any>,
    options: PackageInstanceOptions<any>,
  ): FunctionRegistry {
    if (!pkg.functions) {
      return options.functionRegistry
    }

    const resolvedDeps = options.functionDependencies ?? {}
    const scopedFunctionRegistry = new ScopedFunctionRegistry(options.functionRegistry)

    scopedFunctionRegistry.register(createFunctionsRegistry(pkg.functions, resolvedDeps))

    return scopedFunctionRegistry
  }

  private static resolveComponentRegistry(
    pkg: ForgePackageRegistration<any>,
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

import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { ForgePackageRegistration, PackageDependencies, NodeId } from './chassis/contracts/ast/engine.type'
import ComponentRegistry from './chassis/registries/ComponentRegistry'
import FunctionDefinitionCatalog from './chassis/registries/FunctionDefinitionCatalog'
import CompilationPipeline from './chassis/compilation/pipeline/CompilationPipeline'
import type { ForgeInstrumentation } from './chassis/tracing/ForgeTraceSinkDispatcher'

import type {
  CompiledJourney,
  CompiledStep,
  CompiledPackage,
} from './chassis/contracts/plans/compilationArtefacts.type'
import type { JourneyRouteIndex, StepRouteIndex } from './concerns/route/contracts/routeDescriptors.type'
import ForgeInternalError from './errors/ForgeInternalError'
import type { FunctionRegistryBuilder } from '../authoring/types/functions.type'

export interface PackageInstanceOptions<TDeps> {
  readonly packageDependencies?: TDeps
  readonly instrumentation: ForgeInstrumentation
}

export default class PackageInstance {
  private readonly dependencies: PackageDependencies

  private readonly compilation: CompiledPackage

  private readonly rawConfiguration: JourneyDefinition

  constructor(pkg: ForgePackageRegistration<any>, options: PackageInstanceOptions<any>) {
    const functionBuilders = PackageInstance.resolveFunctionBuilders(pkg)
    const functionDefinitions = PackageInstance.resolveFunctionDefinitions(functionBuilders)

    this.dependencies = {
      functionBuilders,
      packageDependencies: options.packageDependencies ?? {},
      componentRegistry: PackageInstance.resolveComponentRegistry(pkg),
    }

    const pipeline = new CompilationPipeline({
      functionRegistry: functionDefinitions,
      componentRegistry: this.dependencies.componentRegistry,
      instrumentation: options.instrumentation,
    })

    // The pipeline validates the definition in its dsl-validation phase and
    // emits the compilation trace (success or error) before rethrowing.
    this.rawConfiguration = pkg.journey
    this.compilation = pipeline.compile(pkg.journey)
  }

  getDependencies(): PackageDependencies {
    return this.dependencies
  }

  getCompiledStep(stepId: NodeId): CompiledStep {
    const step = this.compilation.steps.get(stepId)

    if (!step) {
      throw new ForgeInternalError(`Step "${stepId}" not found in compiled journey`)
    }

    return step
  }

  getCompiledSteps(): ReadonlyMap<NodeId, CompiledStep> {
    return this.compilation.steps
  }

  getStepRouteIndex(): StepRouteIndex {
    return new Map(this.compilation.stepRouteIndex)
  }

  getJourneyRouteIndex(): JourneyRouteIndex {
    return new Map(this.compilation.journeyRouteIndex)
  }

  getCompiledJourney(journeyId: NodeId): CompiledJourney | undefined {
    return this.compilation.journeys.get(journeyId)
  }

  getConfiguration(): JourneyDefinition {
    return this.rawConfiguration
  }

  getJourneyCode(): string {
    return this.compilation.journeyCode
  }

  private static resolveFunctionBuilders(pkg: ForgePackageRegistration<any>): readonly FunctionRegistryBuilder[] {
    if (!pkg.functions) {
      return []
    }

    return Array.isArray(pkg.functions) ? pkg.functions : [pkg.functions]
  }

  private static resolveFunctionDefinitions(
    functionBuilders: readonly FunctionRegistryBuilder[],
  ): FunctionDefinitionCatalog {
    const functionDefinitions = new FunctionDefinitionCatalog()

    functionBuilders.forEach(functionBuilder => {
      functionDefinitions.register(functionBuilder.getDefinitions())
    })

    return functionDefinitions
  }

  private static resolveComponentRegistry(pkg: ForgePackageRegistration<any>): ComponentRegistry {
    const componentRegistry = new ComponentRegistry()

    if (pkg.components) {
      componentRegistry.registerMany(pkg.components)
    }

    return componentRegistry
  }
}

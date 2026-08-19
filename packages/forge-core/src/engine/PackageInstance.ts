import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { ForgePackageRegistration, PackageDependencies, NodeId } from './chassis/contracts/ast/engine.type'
import { createFunctionsRegistry } from '../authoring/utils/deprecated/createFunctionsRegistry'
import { isFunctionRegistry } from '../authoring/registries/BaseFunctionRegistry'
import ComponentRegistry from './chassis/registries/ComponentRegistry'
import FunctionRegistry from './chassis/registries/FunctionRegistry'
import ScopedComponentRegistry from './chassis/registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './chassis/registries/ScopedFunctionRegistry'
import CompilationPipeline from './chassis/compilation/pipeline/CompilationPipeline'
import type { ForgeInstrumentation } from './chassis/tracing/ForgeTraceSinkDispatcher'

import type {
  CompiledJourney,
  CompiledStep,
  CompiledPackage,
} from './chassis/contracts/plans/compilationArtefacts.type'
import type { JourneyRouteIndex, StepRouteIndex } from './concerns/route/contracts/routeDescriptors.type'
import ForgeInternalError from './errors/ForgeInternalError'

export interface PackageInstanceOptions<TDeps> {
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly functionDependencies?: TDeps
  readonly instrumentation: ForgeInstrumentation
}

export default class PackageInstance {
  private readonly dependencies: PackageDependencies

  private readonly compilation: CompiledPackage

  private readonly rawConfiguration: JourneyDefinition

  constructor(pkg: ForgePackageRegistration<any>, options: PackageInstanceOptions<any>) {
    this.dependencies = {
      functionRegistry: PackageInstance.resolveFunctionRegistry(pkg, options),
      componentRegistry: PackageInstance.resolveComponentRegistry(pkg, options.componentRegistry),
    }

    const pipeline = new CompilationPipeline({
      functionRegistry: this.dependencies.functionRegistry,
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

  private static resolveFunctionRegistry(
    pkg: ForgePackageRegistration<any>,
    options: PackageInstanceOptions<any>,
  ): FunctionRegistry {
    if (!pkg.functions) {
      return options.functionRegistry
    }

    const resolvedDeps = options.functionDependencies ?? {}
    const scopedFunctionRegistry = new ScopedFunctionRegistry(options.functionRegistry)

    const { functions } = pkg

    if (isFunctionRegistry(functions)) {
      scopedFunctionRegistry.register(functions.build(resolvedDeps))
    } else if (Array.isArray(functions)) {
      functions.forEach(registry => {
        scopedFunctionRegistry.register(registry.build(resolvedDeps))
      })
    } else {
      // deprecated: old implementations-map path
      scopedFunctionRegistry.register(createFunctionsRegistry(functions, resolvedDeps))
    }

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

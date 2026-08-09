import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { ForgePackageRegistration, PackageDependencies, NodeId } from './contracts/ast/engine.type'
import { DSLValidator } from './validation/DSLValidator'
import { createFunctionsRegistry } from '../authoring/utils/deprecated/createFunctionsRegistry'
import { isFunctionRegistry } from '../authoring/registries/BaseFunctionRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import ScopedComponentRegistry from './registries/ScopedComponentRegistry'
import ScopedFunctionRegistry from './registries/ScopedFunctionRegistry'
import CompilationPipeline from './compilation/CompilationPipeline'
import CompilationTracer from './diagnostics/tracing/CompilationTracer'
import CompilationTraceProjector from './diagnostics/tracing/CompilationTraceProjector'
import type { ForgeInstrumentation } from './diagnostics/ForgeTraceSinkDispatcher'

import type { CompiledJourney, CompiledStep, CompiledPackage } from './contracts/plans/compilationArtefacts.type'
import type { JourneyRouteIndex, StepRouteIndex } from './concerns/route/contracts/routeDescriptors.type'
import ForgeInternalError from './errors/ForgeInternalError'

export interface PackageInstanceOptions<TDeps> {
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly functionDependencies?: TDeps
  readonly instrumentation: ForgeInstrumentation
}

export default class PackageInstance {
  private readonly traceProjector = new CompilationTraceProjector()

  private readonly dependencies: PackageDependencies

  private readonly compilation: CompiledPackage

  private readonly rawConfiguration: JourneyDefinition

  constructor(pkg: ForgePackageRegistration<any>, options: PackageInstanceOptions<any>) {
    const { instrumentation } = options
    const tracer = new CompilationTracer({
      enabled: instrumentation.enabled,
      captureGeneratedSource: instrumentation.captureGeneratedSource,
    })

    this.dependencies = {
      functionRegistry: PackageInstance.resolveFunctionRegistry(pkg, options),
      componentRegistry: PackageInstance.resolveComponentRegistry(pkg, options.componentRegistry),
    }

    try {
      this.rawConfiguration = tracer.span('load-configuration', 'compilation.dsl-validation', () =>
        PackageInstance.loadConfiguration(pkg.journey),
      )

      const pipeline = new CompilationPipeline({
        functionRegistry: this.dependencies.functionRegistry,
        componentRegistry: this.dependencies.componentRegistry,
        tracer,
      })

      this.compilation = pipeline.compile(this.rawConfiguration)
      this.traceProjector.emit(instrumentation, tracer, 'compiled')
    } catch (e) {
      this.traceProjector.emit(instrumentation, tracer, 'error', e)

      throw e
    }
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

  private static loadConfiguration(configuration: JourneyDefinition): JourneyDefinition {
    DSLValidator.validateJSON(configuration)
    DSLValidator.validateSchema(configuration)

    return configuration
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

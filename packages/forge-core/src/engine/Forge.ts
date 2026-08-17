import PackageInstance from './PackageInstance'
import type { ForgeDependencies, ForgePackageFunctions, ForgePackageRegistration } from './contracts/ast/engine.type'
import FunctionRegistry from './registries/FunctionRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import type { ComponentRegistryEntry } from '../components/types/components.type'
import type { BlockDefinition } from '../components/types/structures.type'
import { createFunctionsRegistry } from '../authoring/utils/deprecated/createFunctionsRegistry'
import { ConditionsRegistry } from '../built-ins/functions/conditions'
import { GeneratorsRegistry } from '../built-ins/functions/generators'
import { TransformersRegistry } from '../built-ins/functions/transformers'
import { coreComponents } from '../built-ins/components'
import { isFunctionRegistry } from '../authoring/registries/BaseFunctionRegistry'
import { ForgeDeprecations } from '../shared/utils/ForgeDeprecations'
import type { FunctionImplementations, FunctionShapeMap } from '../authoring/utils/deprecated/defineFunction.type'
import type { Logger } from '../framework/types/adapter.type'
import type { ForgeRenderer } from '../framework/types/rendering.type'
import type { ForgeError, ForgeOutcome } from '../framework/types/outcome.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ResponseBindings } from '../framework/types/responseBindings.type'
import type { ForgeTopology } from '../framework/types/topology.type'
import MountRegistry from './registries/MountRegistry'
import RequestPipeline from './runtime/pipeline/RequestPipeline'
import ForgeTraceSinkDispatcher from './tracing/ForgeTraceSinkDispatcher'
import type { ForgeInstrumentation, ForgeInstrumentationOptions } from './tracing/ForgeTraceSinkDispatcher'
import RegistrationErrorFormatter from './errors/RegistrationErrorFormatter'
import ForgeRegistrationError from './errors/ForgeRegistrationError'
import ForgeInternalError from './errors/ForgeInternalError'

export interface ForgeExecutionRequest {
  readonly snapshot: RequestSnapshot
  readonly responseBindings?: ResponseBindings
  readonly renderer?: ForgeRenderer<unknown>
}

/**
 * @deprecated Build framework routers directly, for example `createExpressRouter(forge, options)`.
 */
export interface ForgeRouterAdapter {
  build(forge: Forge): unknown
}

export interface ForgeOptions {
  /** Skip registering built-in functions (conditions, transformers, effects). Default: false */
  disableBuiltInFunctions?: boolean

  /** Skip registering built-in components (html, collection-block). Default: false */
  disableBuiltInComponents?: boolean

  /** Enable debug logging for compilation and evaluation. Default: false */
  debug?: boolean

  /**
   * When `true` (default), registration errors from `registerPackage()`
   * throw immediately — fail fast on invalid journey
   * definitions, schema errors, duplicate routes, or compilation failures.
   *
   * When `false`, registration errors are logged via the configured logger
   * and the application continues starting — the failing journey simply
   * won't be available at runtime.
   *
   * @default true
   */
  strictRegistration?: boolean

  /** Logger instance for forge output */
  logger?: Logger | Console

  /**
   * Base path prefix for all routes.
   *
   * When set, all routes will be mounted under this path automatically.
   * Navigation metadata and redirects will include this prefix.
   *
   * @example
   * ```typescript
   * const forge = new Forge({ basePath: '/forms' })
   * app.use(createExpressRouter(forge, { nunjucksEnv }))  // Routes at /forms/journey/step
   * ```
   *
   * @default ''
   */
  basePath?: string

  instrumentation?: ForgeInstrumentationOptions

  /**
   * @deprecated Build framework routers directly, for example `createExpressRouter(forge, options)`.
   */
  frameworkAdapter?: ForgeRouterAdapter
}

export default class Forge {
  private readonly options: Required<Omit<ForgeOptions, 'frameworkAdapter'>> & Pick<ForgeOptions, 'frameworkAdapter'>

  private readonly functionRegistry = new FunctionRegistry()

  private readonly componentRegistry = new ComponentRegistry()

  private readonly dependencies: ForgeDependencies

  private readonly mountRegistry: MountRegistry

  private readonly instrumentation: ForgeInstrumentation

  private readonly requestPipeline: RequestPipeline

  /**
   * Create a new Forge instance
   * Use this for package registration, component/function registries, and routing.
   *
   * @param constructorOptions - Configuration options for Forge
   *
   * @example
   * ```typescript
   * import { Forge } from './'
   * import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
   * import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
   *
   * const forge = new Forge({ logger })
   *   .registerGlobalComponents(govukComponents(nunjucksEnv))
   *   .registerPackage(myPackage)
   *
   * app.use(createExpressRouter(forge, { nunjucksEnv }))
   * ```
   */
  constructor(constructorOptions: ForgeOptions) {
    const defaultOptions = {
      disableBuiltInFunctions: false,
      disableBuiltInComponents: false,
      debug: false,
      strictRegistration: true,
      logger: console,
      basePath: '',
      instrumentation: {},
    }

    this.options = {
      ...defaultOptions,
      ...constructorOptions,
    }

    if (!this.options.disableBuiltInFunctions) {
      this.functionRegistry.register(ConditionsRegistry)
      this.functionRegistry.register(TransformersRegistry)
      this.functionRegistry.register(GeneratorsRegistry)
    }

    if (!this.options.disableBuiltInComponents) {
      this.componentRegistry.registerMany([...coreComponents])
    }

    this.dependencies = {
      logger: this.options.logger,
    }

    this.mountRegistry = new MountRegistry(this.options.basePath)
    this.instrumentation = new ForgeTraceSinkDispatcher(this.options.instrumentation)
    this.requestPipeline = new RequestPipeline({ instrumentation: this.instrumentation })
  }

  /** Add a component to the global registry, making it available to all journeys. */
  registerGlobalComponent(component: ComponentRegistryEntry<BlockDefinition, unknown>): this {
    this.componentRegistry.registerMany([component])

    return this
  }

  /** Add components to the global registry, making them available to all journeys. */
  registerGlobalComponents(components: ComponentRegistryEntry<BlockDefinition, unknown>[]): this {
    this.componentRegistry.registerMany(components)

    return this
  }

  /** Add functions to the global registry, making them available to all journeys. */
  registerGlobalFunctions<TDeps>(functions: ForgePackageFunctions<TDeps>, deps?: TDeps): this {
    const resolvedDeps = (deps ?? {}) as TDeps

    if (isFunctionRegistry(functions)) {
      this.functionRegistry.register(functions.build(resolvedDeps))
    } else if (Array.isArray(functions)) {
      functions.forEach(registry => {
        if (isFunctionRegistry(registry)) {
          this.functionRegistry.register(registry.build(resolvedDeps))
        }
      })
    } else {
      this.functionRegistry.register(
        createFunctionsRegistry(functions as FunctionImplementations<FunctionShapeMap, TDeps>, resolvedDeps),
      )
    }

    return this
  }

  /**
   * Register a package (journey + custom functions + components) with optional dependencies.
   *
   * This is a convenience method that registers components, functions, and the journey
   * in the correct order.
   *
   * @param pkg - The package containing journey, functions, and optional components
   * @param deps - Dependencies required by the package's functions (optional for packages with no deps)
   *
   * @example
   * ```typescript
   * // Package with dependencies
   * forge.registerPackage(myPackage, { api: services.apiClient })
   *
   * // Package without dependencies
   * forge.registerPackage(simplePackage)
   *
   * // Conditionally disabled package
   * forge.registerPackage(createForgePackage({
   *   enabled: config.featureFlags.myFormEnabled,
   *   journey: myJourney,
   * }))
   * ```
   */
  registerPackage<TDeps>(pkg: ForgePackageRegistration<TDeps>, deps?: TDeps): this {
    if (!pkg || (pkg as { forgePackage?: unknown }).forgePackage !== true) {
      this.handleRegistrationError(
        new Error(
          'Packages must be created with createForgePackage(...) before registration. ' +
            'Wrap your package definition: registerPackage(createForgePackage({ journey, ... }))',
        ),
      )

      return this
    }

    if (pkg.enabled === false) {
      return this
    }

    try {
      const packageInstance = new PackageInstance(pkg, {
        functionRegistry: this.functionRegistry,
        componentRegistry: this.componentRegistry,
        functionDependencies: deps,
        instrumentation: this.instrumentation,
      })

      this.registerPackageInstance(packageInstance)
    } catch (e) {
      this.handleRegistrationError(e)
    }

    return this
  }

  private registerPackageInstance(packageInstance: PackageInstance): void {
    this.mountRegistry.register(packageInstance)
  }

  private handleRegistrationError(e: unknown): void {
    const formatted = RegistrationErrorFormatter.format(e)

    if (this.options.strictRegistration) {
      if (typeof formatted === 'string') {
        throw new ForgeRegistrationError(formatted)
      }

      throw e
    }

    this.options.logger.error(e instanceof Error ? e : new Error(String(e)))
  }

  /**
   * The routes exposed by the registered journeys, as plain data.
   *
   * Adapters consume this to register routes with their framework and to map an
   * incoming request back to a {@link RequestSnapshot.nodeId}.
   */
  getTopology(): ForgeTopology {
    return this.mountRegistry.getTopology()
  }

  getDependencies(): ForgeDependencies {
    return this.dependencies
  }

  /** The configured logger. */
  getLogger(): Logger | Console {
    return this.options.logger
  }

  getInstrumentation(): ForgeInstrumentation {
    return this.instrumentation
  }

  /**
   * @deprecated Build framework routers directly, for example `createExpressRouter(forge, options)`.
   */
  getRouter(): unknown {
    ForgeDeprecations.warn(
      'FORGE_DEP_getRouter',
      'frameworkAdapter and getRouter() are deprecated - build framework routers directly, for example createExpressRouter(forge, options).',
    )

    if (!this.options.frameworkAdapter) {
      throw new Error(
        'getRouter() requires a frameworkAdapter. Pass one to new Forge({ frameworkAdapter }), ' +
          'or build the router directly (e.g. createExpressRouter(forge, options)).',
      )
    }

    return this.options.frameworkAdapter.build(this)
  }

  async execute(request: ForgeExecutionRequest): Promise<ForgeOutcome<unknown>> {
    try {
      const node = this.mountRegistry.getNode(request.snapshot.nodeId)

      if (!node) {
        throw new ForgeInternalError(`No node registered for "${request.snapshot.nodeId}"`)
      }

      return await this.requestPipeline.evaluate({ node, ...request })
    } catch (error) {
      return { kind: 'error', error: this.toError(error) }
    }
  }

  private toError(error: unknown): ForgeError {
    if (error instanceof Error) {
      return error
    }

    return new Error(String(error), { cause: error })
  }
}

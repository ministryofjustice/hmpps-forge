import PackageInstance from './PackageInstance'
import type { ForgeDependencies, ForgePackageFunctions, ForgePackageRegistration } from './contracts/ast/engine.type'
import FunctionRegistry from './registries/FunctionRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import type { ComponentRegistryEntry } from '../components/types/components.type'
import type { BlockDefinition } from '../components/types/structures.type'
import { createFunctionsRegistry } from '../authoring/utils/deprecated/createFunctionsRegistry'
import { BaseFunctionRegistry } from '../authoring/registries/BaseFunctionRegistry'
import type { Logger } from '../framework/types/adapter.type'
import type { ForgeRenderer } from '../framework/rendering/types'
import type { ForgeOutcome } from '../framework/types/outcome.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ResponseBindings } from '../framework/types/responseBindings.type'
import type { ForgeTopology } from '../framework/types/topology.type'
import MountRegistry from './registries/MountRegistry'
import RequestEvaluator from './runtime/RequestEvaluator'
import ForgeTraceSinkDispatcher from './diagnostics/ForgeTraceSinkDispatcher'
import type { ForgeInstrumentation, ForgeInstrumentationOptions } from './diagnostics/ForgeTraceSinkDispatcher'
import RegistrationErrorFormatter from './errors/RegistrationErrorFormatter'
import ForgeRegistrationError from './errors/ForgeRegistrationError'

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

  private readonly requestEvaluator: RequestEvaluator

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
      this.functionRegistry.registerBuiltInFunctions()
    }

    if (!this.options.disableBuiltInComponents) {
      this.componentRegistry.registerBuiltInComponents()
    }

    this.dependencies = {
      logger: this.options.logger,
    }

    this.mountRegistry = new MountRegistry(this.options.basePath)
    this.instrumentation = new ForgeTraceSinkDispatcher(this.options.instrumentation)
    this.requestEvaluator = new RequestEvaluator({ instrumentation: this.instrumentation })
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

    if (functions instanceof BaseFunctionRegistry) {
      this.functionRegistry.register(functions.build(resolvedDeps))
    } else if (Array.isArray(functions)) {
      functions.forEach(registry => {
        if (registry instanceof BaseFunctionRegistry) {
          this.functionRegistry.register(registry.build(resolvedDeps))
        }
      })
    } else {
      // deprecated: old implementations-map path
      this.functionRegistry.register(createFunctionsRegistry(functions, resolvedDeps))
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
    if (pkg.enabled === false) {
      return this
    }

    try {
      const packageInstance = new PackageInstance(pkg, {
        functionRegistry: this.functionRegistry,
        componentRegistry: this.componentRegistry,
        functionDependencies: deps,
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
    this.options.logger.warn(
      '[Forge] `frameworkAdapter` and `getRouter()` are deprecated. Build the router directly instead.',
    )

    if (!this.options.frameworkAdapter) {
      throw new Error(
        'getRouter() requires a frameworkAdapter. Pass one to new Forge({ frameworkAdapter }), ' +
          'or build the router directly (e.g. createExpressRouter(forge, options)).',
      )
    }

    return this.options.frameworkAdapter.build(this)
  }

  execute(request: ForgeExecutionRequest): Promise<ForgeOutcome<unknown>> {
    const node = this.mountRegistry.getNode(request.snapshot.nodeId)

    if (!node) {
      throw new Error(`[Forge] No node registered for "${request.snapshot.nodeId}"`)
    }

    return this.requestEvaluator.evaluate({ node, ...request })
  }
}

import PackageInstance from './PackageInstance'
import type {
  ForgeDependencies,
  ForgeFunctionImplementations,
  ForgePackageRegistration,
} from './contracts/ast/engine.type'
import FunctionRegistry from './registries/FunctionRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import type { ComponentRegistryEntry } from '../components/types/components.type'
import { createFunctionsRegistry } from '../authoring/utils/createFunctionsRegistry'
import type { Logger } from '../framework/types/adapter.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ForgeOutcome } from '../framework/types/outcome.type'
import type { ForgeTopology } from '../framework/types/topology.type'
import { ForgeInstrumentation } from '../instrumentation/ForgeInstrumentation'
import type { ForgeInstrumentationOptions } from '../instrumentation/ForgeInstrumentation'
import ForgeEvaluator from './runtime/routes/ForgeEvaluator'
import RegistrationErrorFormatter from './errors/RegistrationErrorFormatter'

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

  /** Instrumentation and debug trace configuration. */
  instrumentation?: ForgeInstrumentationOptions

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

  /**
   * Optional framework adapter that builds a router from this engine.
   *
   * Convenience for the common server case: when provided, {@link Forge.getRouter}
   * returns the router this adapter builds. It is exactly equivalent to calling
   * the adapter directly — `app.use(createExpressRouter(forge, options))` — so
   * you can use either style.
   *
   * @example
   * ```typescript
   * const forge = new Forge({
   *   logger,
   *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
   * })
   * app.use(forge.getRouter() as express.Router)
   * ```
   */
  frameworkAdapter?: ForgeRouterAdapter
}

/**
 * Builds a framework router/handler from a configured {@link Forge} engine.
 *
 * Implementations consume the engine's public surface ({@link Forge.getTopology},
 * {@link Forge.evaluate}, …) — see `createExpressRouter` / `ExpressFrameworkAdapter`.
 */
export interface ForgeRouterAdapter {
  build(forge: Forge): unknown
}

interface ResolvedForgeOptions extends Omit<Required<ForgeOptions>, 'instrumentation' | 'frameworkAdapter'> {
  instrumentation?: ForgeInstrumentationOptions
  frameworkAdapter?: ForgeRouterAdapter
}

export default class Forge {
  private readonly options: ResolvedForgeOptions

  private readonly functionRegistry = new FunctionRegistry()

  private readonly componentRegistry = new ComponentRegistry()

  private readonly instrumentation: ForgeInstrumentation

  private readonly dependencies: ForgeDependencies

  private readonly forgeEvaluator: ForgeEvaluator

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
    }

    this.options = {
      ...defaultOptions,
      ...constructorOptions,
    }

    this.instrumentation = new ForgeInstrumentation(this.options.instrumentation, this.options.logger)

    if (!this.options.disableBuiltInFunctions) {
      this.functionRegistry.registerBuiltInFunctions()
    }

    if (!this.options.disableBuiltInComponents) {
      this.componentRegistry.registerBuiltInComponents()
    }

    this.dependencies = {
      logger: this.options.logger,
      instrumentation: this.instrumentation,
    }

    this.forgeEvaluator = new ForgeEvaluator(this.dependencies, this.options)
  }

  /** Add a component to the global registry, making it available to all journeys. */
  registerGlobalComponent(component: ComponentRegistryEntry<any>): this {
    this.componentRegistry.registerMany([component])

    return this
  }

  /** Add components to the global registry, making them available to all journeys. */
  registerGlobalComponents(components: ComponentRegistryEntry<any>[]): this {
    this.componentRegistry.registerMany(components)

    return this
  }

  /** Add functions to the global registry, making them available to all journeys. */
  registerGlobalFunctions<TDeps>(functions: ForgeFunctionImplementations<TDeps>, deps?: TDeps): this {
    const resolvedDeps = (deps ?? {}) as TDeps

    this.functionRegistry.register(createFunctionsRegistry(functions, resolvedDeps))

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

    const span = this.instrumentation.startSpan('journey-registration')

    try {
      const packageInstance = new PackageInstance(pkg, {
        functionRegistry: this.functionRegistry,
        componentRegistry: this.componentRegistry,
        functionDependencies: deps,
      })

      const routeCount = this.registerPackageInstance(packageInstance)

      span.setAttributes({
        journeyCode: packageInstance.getJourneyCode(),
        journeyTitle: packageInstance.getJourneyTitle(),
        routeCount,
      })
    } catch (e) {
      span.recordError(e)
      this.handleRegistrationError(e)
    } finally {
      span.end()
    }

    return this
  }

  private registerPackageInstance(packageInstance: PackageInstance): number {
    return this.forgeEvaluator.mount(packageInstance)
  }

  private handleRegistrationError(e: unknown): void {
    this.logRegistrationError(e)

    if (this.options.strictRegistration) {
      throw e
    }
  }

  private logRegistrationError(e: unknown): void {
    this.dependencies.logger.error(RegistrationErrorFormatter.format(e))
  }

  /**
   * Evaluate a single request against the registered journeys.
   *
   * Takes a framework-agnostic {@link RequestSnapshot} (built by an adapter from
   * its native request) and returns a {@link ForgeOutcome} describing what to
   * render, where to navigate, or which error to surface. The engine performs
   * no I/O and touches no native request or response.
   */
  evaluate(snapshot: RequestSnapshot): Promise<ForgeOutcome> {
    return this.forgeEvaluator.evaluate(snapshot)
  }

  /**
   * The routes exposed by the registered journeys, as plain data.
   *
   * Adapters consume this to register routes with their framework and to map an
   * incoming request back to a {@link RequestSnapshot.nodeId}.
   */
  getTopology(): ForgeTopology {
    return this.forgeEvaluator.getTopology()
  }

  /** The instrumentation instance, so adapters can nest request spans under the engine's. */
  getInstrumentation(): ForgeInstrumentation {
    return this.instrumentation
  }

  /** The configured logger. */
  getLogger(): Logger | Console {
    return this.options.logger
  }

  /**
   * Build the framework router from the configured `frameworkAdapter`.
   *
   * Convenience for the common server case; equivalent to invoking the adapter
   * directly (e.g. `createExpressRouter(forge, options)`). Requires a
   * `frameworkAdapter` to have been passed to the constructor.
   */
  getRouter(): unknown {
    if (!this.options.frameworkAdapter) {
      throw new Error(
        'getRouter() requires a frameworkAdapter. Pass one to new Forge({ frameworkAdapter }), ' +
          'or build the router directly (e.g. createExpressRouter(forge, options)).',
      )
    }

    return this.options.frameworkAdapter.build(this)
  }
}

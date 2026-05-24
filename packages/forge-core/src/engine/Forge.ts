import PackageInstance from './PackageInstance'
import type { ForgeDependencies, ForgeFunctionImplementations, ForgePackageRegistration } from './types/engine.type'
import FunctionRegistry from './registries/FunctionRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import type { ComponentRegistryEntry } from '../components/types/components.type'
import { createFunctionsRegistry } from '../authoring/utils/createFunctionsRegistry'
import type { FrameworkAdapterBuilder, Logger } from '../framework/types/adapter.type'
import ForgeInstrumentation from '../instrumentation/ForgeInstrumentation'
import type { ForgeInstrumentationOptions } from '../instrumentation/ForgeInstrumentation'
import ForgeRouter from './runtime/routes/ForgeRouter'
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
   * const forge = new Forge({
   *   basePath: '/forms',
   *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
   * })
   * app.use(forge.getRouter())  // Routes at /forms/journey/step
   * ```
   *
   * @default ''
   */
  basePath?: string

  /**
   * Framework adapter builder for web framework integration.
   *
   * Use the static `configure()` method on your adapter class to create a builder.
   * Forge will call `build()` internally to provide its dependencies.
   *
   * @example
   * ```typescript
   * import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
   *
   * const nunjucksEnv = nunjucksSetup(app)
   * frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv })
   * ```
   */
  frameworkAdapter: FrameworkAdapterBuilder<any, any, any>
}

interface ResolvedForgeOptions extends Omit<Required<ForgeOptions>, 'instrumentation'> {
  instrumentation?: ForgeInstrumentationOptions
}

export default class Forge {
  private readonly options: ResolvedForgeOptions

  private readonly functionRegistry = new FunctionRegistry()

  private readonly componentRegistry = new ComponentRegistry()

  private readonly instrumentation: ForgeInstrumentation

  private readonly dependencies: ForgeDependencies

  private readonly forgeRouter: ForgeRouter<any>

  /**
   * Create a new Forge instance
   * Use this for package registration, component/function registries, and routing.
   *
   * @param constructorOptions - Configuration options for Forge
   *
   * @example
   * ```typescript
   * import { Forge } from './'
   * import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
   * import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
   *
   * const forge = new Forge({
   *   logger,
   *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
   * })
   *   .registerGlobalComponents(govukComponents(nunjucksEnv))
   *   .registerPackage(myPackage)
   *
   * app.use(forge.getRouter() as express.Router)
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
      frameworkAdapter: this.options.frameworkAdapter.build({
        logger: this.options.logger,
        instrumentation: this.instrumentation,
      }),
      instrumentation: this.instrumentation,
    }

    this.forgeRouter = new ForgeRouter(this.dependencies, this.options)
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
    const routeCount = this.forgeRouter.mount(packageInstance, this.dependencies)

    this.dependencies.logger.info(
      { journey: packageInstance.getJourneyCode(), routes: routeCount },
      `Forge: Registered journey '${packageInstance.getJourneyTitle()}' with ${routeCount} routes`,
    )
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
   * Get the main router that has all registered routes.
   * The router type depends on the framework adapter used.
   */
  getRouter(): unknown {
    return this.forgeRouter.getRouter()
  }
}

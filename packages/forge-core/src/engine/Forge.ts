import type { JourneyDefinition } from '../authoring/types/structures.type'
import JourneyInstance from './JourneyInstance'
import { JourneyInstanceDependencies, ForgePackage } from './types/engine.type'
import FunctionRegistry from './FunctionRegistry'
import ComponentRegistry from '../components/ComponentRegistry'
import { ComponentRegistryEntry } from '../components/types/components.type'
import { FunctionRegistryObject } from '../authoring/types/functions.type'
import { createFunctionsRegistry } from '../authoring/utils/createFunctionsRegistry'
import type { FrameworkAdapterBuilder, Logger } from '../framework/types/adapter.type'
import ForgeRouter from './runtime/routes/ForgeRouter'

export interface ForgeOptions {
  /** Skip registering built-in functions (conditions, transformers, effects). Default: false */
  disableBuiltInFunctions?: boolean

  /** Skip registering built-in components (html, collection-block). Default: false */
  disableBuiltInComponents?: boolean

  /** Enable debug logging for compilation and evaluation. Default: false */
  debug?: boolean

  /**
   * Defer per-step compilation (thunk handlers, linked closures, runtime plans)
   * until the step is first accessed.
   *
   * When `true` (default), each step compiles on first request — faster startup,
   * but the first user to hit a step pays the compilation cost.
   *
   * When `false`, all steps compile at registration time — slower startup,
   * but zero compilation overhead on any request.
   *
   * @default true
   */
  lazyStepCompilation?: boolean

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

export default class Forge {
  private readonly options: Required<ForgeOptions>

  private readonly functionRegistry = new FunctionRegistry()

  private readonly componentRegistry = new ComponentRegistry()

  private readonly dependencies: JourneyInstanceDependencies

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
   *   .registerComponents(govukComponents(nunjucksEnv))
   *   .register(myJourney)
   *
   * app.use(forge.getRouter() as express.Router)
   * ```
   */
  constructor(constructorOptions: ForgeOptions) {
    const defaultOptions = {
      disableBuiltInFunctions: false,
      disableBuiltInComponents: false,
      debug: false,
      lazyStepCompilation: true,
      logger: console,
      basePath: '',
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
      functionRegistry: this.functionRegistry,
      componentRegistry: this.componentRegistry,
      logger: this.options.logger,
      frameworkAdapter: this.options.frameworkAdapter.build({
        componentRegistry: this.componentRegistry,
        logger: this.options.logger,
      }),
    }

    this.forgeRouter = new ForgeRouter(this.dependencies, this.options)
  }

  /** Add a new component to forge */
  registerComponent(component: ComponentRegistryEntry<any>): this {
    this.componentRegistry.registerMany([component])

    return this
  }

  /** Add new components to forge */
  registerComponents(components: ComponentRegistryEntry<any>[]): this {
    this.componentRegistry.registerMany(components)

    return this
  }

  /** Register functions from a registry object */
  registerFunctions(functions: FunctionRegistryObject): this {
    this.functionRegistry.register(functions)

    return this
  }

  /** Register a journey with forge */
  register(journeyConfiguration: string | JourneyDefinition): this {
    try {
      const instance = JourneyInstance.createFromConfiguration(journeyConfiguration, this.dependencies)

      const routesBefore = this.forgeRouter.getRegisteredRoutes().length

      if (!this.options.lazyStepCompilation) {
        instance.compileAllSteps()
      }

      this.forgeRouter.mount(instance)

      const routeCount = this.forgeRouter.getRegisteredRoutes().length - routesBefore

      this.dependencies.logger.info(
        { journey: instance.getJourneyCode(), routes: routeCount },
        `Forge: Registered journey '${instance.getJourneyTitle()}' with ${routeCount} routes`,
      )
    } catch (e) {
      this.logRegistrationError(e)
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
  registerPackage<TDeps>(pkg: ForgePackage<TDeps>, deps?: TDeps): this {
    if (pkg.enabled === false) {
      return this
    }

    if (pkg.components) {
      this.registerComponents(pkg.components)
    }

    if (pkg.functions) {
      const resolvedDeps = (deps ?? {}) as TDeps
      this.registerFunctions(createFunctionsRegistry(pkg.functions, resolvedDeps))
    }

    this.register(pkg.journey)

    return this
  }

  private logRegistrationError(e: unknown) {
    if (e instanceof AggregateError) {
      this.dependencies.logger.error(`${e.message}:`)

      e.errors.forEach(error => {
        this.dependencies.logger.error(error?.toString ? error.toString() : String(error))
      })
    } else {
      this.dependencies.logger.error(e)
    }
  }

  /**
   * Get the main router that has all registered routes.
   * The router type depends on the framework adapter used.
   */
  getRouter(): unknown {
    return this.forgeRouter.getRouter()
  }
}

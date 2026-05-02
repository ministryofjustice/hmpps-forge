import type { JourneyDefinition } from '../authoring/types/structures.type'
import JourneyInstance from './JourneyInstance'
import { JourneyInstanceDependencies } from './types/engine.type'
import FunctionRegistry from './registries/FunctionRegistry'
import ScopedFunctionRegistry from './registries/ScopedFunctionRegistry'
import ComponentRegistry from './registries/ComponentRegistry'
import ScopedComponentRegistry from './registries/ScopedComponentRegistry'
import type { ComponentRegistryEntry } from '../components/types/components.type'
import type { BlockDefinition } from '../components/types/structures.type'
import type { FunctionEvaluator } from '../authoring/types/functions.type'
import { createFunctionsRegistry } from '../authoring/utils/createFunctionsRegistry'
import type { FrameworkAdapterBuilder, Logger } from '../framework/types/adapter.type'
import ForgeRouter from './runtime/routes/ForgeRouter'

type ForgeFunctionImplementations<TDeps> = Record<string, (deps: TDeps) => FunctionEvaluator<unknown>>

interface ForgePackageRegistration<TDeps = Record<string, never>> {
  journey: string | JourneyDefinition
  functions?: ForgeFunctionImplementations<TDeps>
  components?: ComponentRegistryEntry<BlockDefinition>[]
  enabled?: boolean
}

type DiagnosticError = {
  readonly name?: unknown
  readonly message?: unknown
  readonly formattedPath?: unknown
  readonly path?: unknown
  readonly code?: unknown
  readonly expected?: unknown
  readonly functionName?: unknown
  readonly functionType?: unknown
  readonly variant?: unknown
  readonly phase?: unknown
  readonly nodeId?: unknown
  readonly cause?: unknown
}

export interface ForgeOptions {
  /** Skip registering built-in functions (conditions, transformers, effects). Default: false */
  disableBuiltInFunctions?: boolean

  /** Skip registering built-in components (html, collection-block). Default: false */
  disableBuiltInComponents?: boolean

  /** Enable debug logging for compilation and evaluation. Default: false */
  debug?: boolean

  /**
   * When `true` (default), registration errors (from `register()` and
   * `registerPackage()`) throw immediately — fail fast on invalid journey
   * definitions, schema errors, duplicate routes, or compilation failures.
   *
   * When `false`, registration errors are logged via the configured logger
   * and the application continues starting — the failing journey simply
   * won't be available at runtime.
   *
   * @default true
   */
  strictRegistration?: boolean

  /**
   * Defer route compilation until the route is first accessed.
   *
   * When `true` (default), each step compiles on first request — faster startup,
   * but the first user to hit a step pays the compilation cost.
   *
   * When `false`, route artefacts compile at registration time — slower startup,
   * but first requests do not pay compilation costs.
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
   *   .registerGlobalComponents(govukComponents(nunjucksEnv))
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
      strictRegistration: true,
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

    this.options.logger.warn('DEMO')

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

  /** Register a journey with forge */
  register(journeyConfiguration: string | JourneyDefinition): this {
    try {
      this.registerJourney(journeyConfiguration, this.dependencies)
    } catch (e) {
      this.handleRegistrationError(e)
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
      let journeyDependencies = this.dependencies

      if (pkg.functions) {
        const resolvedDeps = (deps ?? {}) as TDeps
        const scopedFunctionRegistry = new ScopedFunctionRegistry(this.functionRegistry)

        scopedFunctionRegistry.register(createFunctionsRegistry(pkg.functions, resolvedDeps))
        journeyDependencies = { ...journeyDependencies, functionRegistry: scopedFunctionRegistry }
      }

      if (pkg.components) {
        const scopedComponentRegistry = new ScopedComponentRegistry(this.componentRegistry)

        scopedComponentRegistry.registerMany(pkg.components)
        journeyDependencies = {
          ...journeyDependencies,
          componentRegistry: scopedComponentRegistry,
          frameworkAdapter: this.options.frameworkAdapter.build({
            componentRegistry: scopedComponentRegistry,
            logger: this.options.logger,
          }),
        }
      }

      this.registerJourney(pkg.journey, journeyDependencies)
    } catch (e) {
      this.handleRegistrationError(e)
    }

    return this
  }

  private registerJourney(
    journeyConfiguration: string | JourneyDefinition,
    dependencies: JourneyInstanceDependencies,
  ): void {
    const instance = JourneyInstance.createFromConfiguration(journeyConfiguration, dependencies)

    const routesBefore = this.forgeRouter.getRegisteredRoutes().length

    if (!this.options.lazyStepCompilation) {
      instance.compileAllRouteArtefacts()
    }

    this.forgeRouter.mount(instance, dependencies)

    const routeCount = this.forgeRouter.getRegisteredRoutes().length - routesBefore

    dependencies.logger.info(
      { journey: instance.getJourneyCode(), routes: routeCount },
      `Forge: Registered journey '${instance.getJourneyTitle()}' with ${routeCount} routes`,
    )
  }

  private handleRegistrationError(e: unknown): void {
    this.logRegistrationError(e)

    if (this.options.strictRegistration) {
      throw e
    }
  }

  private logRegistrationError(e: unknown): void {
    if (e instanceof AggregateError) {
      this.dependencies.logger.error(this.formatAggregateRegistrationError(e))
    } else {
      this.dependencies.logger.error(e)
    }
  }

  private formatAggregateRegistrationError(error: AggregateError): string {
    const entries = error.errors.map((entry, index) => this.formatRegistrationErrorEntry(entry, index))

    return [`Forge registration failed: ${error.message}`, '', ...entries].join('\n')
  }

  private formatRegistrationErrorEntry(error: unknown, index: number): string {
    const diagnostic = this.toDiagnosticError(error)
    const title = this.formatErrorTitle(diagnostic, error)
    const fields = this.formatErrorFields(diagnostic)

    return [`${index + 1}. ${title}`, ...fields.map(field => `   ${field}`)].join('\n')
  }

  private formatErrorTitle(diagnostic: DiagnosticError | undefined, error: unknown): string {
    const name = this.formatValue(diagnostic?.name)
    const message = this.formatValue(diagnostic?.message)

    if (name && message) {
      return `${name}: ${message}`
    }

    if (message) {
      return message
    }

    return this.formatValue(error) ?? String(error)
  }

  private formatErrorFields(diagnostic: DiagnosticError | undefined): string[] {
    if (!diagnostic) {
      return []
    }

    const path = this.formatValue(diagnostic.formattedPath) ?? this.formatPathValue(diagnostic.path)
    const fields = [
      { label: 'Phase', value: this.formatValue(diagnostic.phase) },
      { label: 'Path', value: path },
      { label: 'Node', value: this.formatValue(diagnostic.nodeId) },
      { label: 'Code', value: this.formatValue(diagnostic.code) },
      { label: 'Expected', value: this.formatValue(diagnostic.expected) },
      { label: 'Function', value: this.formatValue(diagnostic.functionName) },
      { label: 'Type', value: this.formatValue(diagnostic.functionType) },
      { label: 'Variant', value: this.formatValue(diagnostic.variant) },
      { label: 'Cause', value: this.formatValue(diagnostic.cause) },
    ]

    return fields
      .filter(field => field.value !== undefined)
      .map(field => `${field.label}: ${field.value}`)
  }

  private toDiagnosticError(error: unknown): DiagnosticError | undefined {
    if (!error || typeof error !== 'object') {
      return undefined
    }

    return error as DiagnosticError
  }

  private formatPathValue(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map(pathPart => String(pathPart)).join('.') : 'root'
    }

    return this.formatValue(value)
  }

  private formatValue(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined
    }

    return String(value)
  }

  /**
   * Get the main router that has all registered routes.
   * The router type depends on the framework adapter used.
   */
  getRouter(): unknown {
    return this.forgeRouter.getRouter()
  }
}

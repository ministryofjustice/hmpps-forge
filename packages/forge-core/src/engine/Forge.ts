import PackageInstance from './PackageInstance'
import type { ForgeDependencies, ForgePackageRegistration } from './chassis/contracts/ast/engine.type'
import type { Logger } from '../framework/types/adapter.type'
import type { ForgeRenderer } from '../framework/types/rendering.type'
import type { ForgeError, ForgeOutcome } from '../framework/types/outcome.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ResponseBindings } from '../framework/types/responseBindings.type'
import type { ForgeTopology } from '../framework/types/topology.type'
import MountRegistry from './chassis/registries/MountRegistry'
import RequestPipeline from './chassis/runtime/pipeline/RequestPipeline'
import ForgeTraceSinkDispatcher from './chassis/tracing/ForgeTraceSinkDispatcher'
import type { ForgeInstrumentation, ForgeInstrumentationOptions } from './chassis/tracing/ForgeTraceSinkDispatcher'
import RegistrationErrorFormatter from './errors/RegistrationErrorFormatter'
import ForgeRegistrationError from './errors/ForgeRegistrationError'
import ForgeInternalError from './errors/ForgeInternalError'
import { DEFAULT_MAX_ITERATOR_ITERATIONS } from './chassis/runtime/pipeline/IteratorBudget'

export interface ForgeExecutionRequest {
  readonly snapshot: RequestSnapshot
  readonly responseBindings?: ResponseBindings
  readonly renderer?: ForgeRenderer<unknown>

  /** Stable capabilities supplied by the active framework adapter. */
  readonly adapterDependencies?: object

  /** Resolves capabilities used only while preparing this request's function evaluators. */
  readonly requestDependencies?: () => object | PromiseLike<object>
}

export interface ForgeOptions {
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

  /** Maximum cumulative iterator iterations allowed during one request. Default: 10,000 */
  maxIteratorIterations?: number
}

export default class Forge {
  private readonly options: Required<ForgeOptions>

  private readonly dependencies: ForgeDependencies

  private readonly mountRegistry: MountRegistry

  private readonly instrumentation: ForgeInstrumentation

  private readonly requestPipeline: RequestPipeline

  /**
   * Create a new Forge instance
   * Use this for package registration and routing.
   *
   * @param constructorOptions - Configuration options for Forge
   *
   * @example
   * ```typescript
   * import { Forge } from '.'
   * import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
   *
   * const forge = new Forge({ logger })
   *   .registerPackage(myPackage)
   *
   * app.use(createExpressRouter(forge, { nunjucksEnv }))
   * ```
   */
  constructor(constructorOptions: ForgeOptions) {
    const defaultOptions = {
      debug: false,
      strictRegistration: true,
      logger: console,
      basePath: '',
      instrumentation: {},
      maxIteratorIterations: DEFAULT_MAX_ITERATOR_ITERATIONS,
    }

    this.options = {
      ...defaultOptions,
      ...constructorOptions,
    }

    this.dependencies = {
      logger: this.options.logger,
    }

    this.mountRegistry = new MountRegistry(this.options.basePath)
    this.instrumentation = new ForgeTraceSinkDispatcher(this.options.instrumentation)
    this.requestPipeline = new RequestPipeline({
      instrumentation: this.instrumentation,
      maxIteratorIterations: this.options.maxIteratorIterations,
    })
  }

  /**
   * Register a package (journey + custom functions + components) with optional dependencies.
   *
   * This is a convenience method that registers components, functions, and the journey
   * in the correct order.
   *
   * @param pkg - The package containing journey, functions, and optional components
   * @param packageDependencies - Application-wide dependencies required by the package's functions
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
  registerPackage<TDeps>(pkg: ForgePackageRegistration<TDeps>, packageDependencies?: TDeps): this {
    if (!pkg || (pkg as { forgePackage?: unknown }).forgePackage !== true) {
      this.handleRegistrationError(
        new ForgeRegistrationError(
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
        packageDependencies,
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

import type Logger from 'bunyan'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { formatBox } from '@form-engine/logging/formatBox'
import FormInstance from '@form-engine/core/FormInstance'
import { FormInstanceDependencies, FormPackage } from '@form-engine/core/types/engine.type'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'
import { FunctionRegistryObject } from '@form-engine/registry/types/functions.type'
import { FrameworkAdapterBuilder } from '@form-engine/core/runtime/routes/types'
import FormEngineRouter from '@form-engine/core/runtime/routes/FormEngineRouter'

export interface FormEngineOptions {
  /** Skip registering built-in functions (conditions, transformers, effects). Default: false */
  disableBuiltInFunctions?: boolean

  /** Skip registering built-in components (html, collection-block). Default: false */
  disableBuiltInComponents?: boolean

  /** Enable debug logging for form compilation and evaluation. Default: false */
  debug?: boolean

  /** Logger instance for form engine output */
  logger?: Logger | Console

  /**
   * Base path prefix for all form routes.
   *
   * When set, all routes will be mounted under this path automatically.
   * Navigation metadata and redirects will include this prefix.
   *
   * @example
   * ```typescript
   * const formEngine = new FormEngine({
   *   basePath: '/forms',
   *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
   * })
   * app.use(formEngine.getRouter())  // Routes at /forms/journey/step
   * ```
   *
   * @default ''
   */
  basePath?: string

  /**
   * Framework adapter builder for web framework integration.
   *
   * Use the static `configure()` method on your adapter class to create a builder.
   * FormEngine will call `build()` internally to provide its dependencies.
   *
   * @example
   * ```typescript
   * import { ExpressFrameworkAdapter } from '@form-engine-express-nunjucks'
   *
   * const nunjucksEnv = nunjucksSetup(app)
   * frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv })
   * ```
   */
  frameworkAdapter: FrameworkAdapterBuilder<any, any, any>
}

export default class FormEngine {
  private readonly options: FormEngineOptions

  private readonly functionRegistry = new FunctionRegistry()

  private readonly componentRegistry = new ComponentRegistry()

  private readonly forms = new Map<string, FormInstance>()

  private readonly dependencies: FormInstanceDependencies

  private readonly formEngineRouter: FormEngineRouter<any>

  /**
   * Create a new FormEngine instance
   * Use this for form registration, component/function registries, and routing.
   *
   * @param constructorOptions - Configuration options for the form engine
   *
   * @example
   * ```typescript
   * import { FormEngine } from '@form-engine/core'
   * import { ExpressFrameworkAdapter } from '@form-engine-express-nunjucks'
   * import { govukComponents } from '@form-engine-govuk-components'
   *
   * const formEngine = new FormEngine({
   *   logger,
   *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
   * })
   *   .registerComponents(govukComponents(nunjucksEnv))
   *   .registerForm(myJourney)
   *
   * app.use(formEngine.getRouter() as express.Router)
   * ```
   */
  constructor(constructorOptions: FormEngineOptions) {
    this.options = {
      disableBuiltInFunctions: false,
      disableBuiltInComponents: false,
      debug: false,
      logger: console,
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
      }),
    }

    this.formEngineRouter = new FormEngineRouter(this.dependencies, this.options)
  }

  /** Add a new component to the form engine */
  registerComponent(component: ComponentRegistryEntry<any>): this {
    this.componentRegistry.registerMany([component])

    return this
  }

  /** Add new components to the form engine */
  registerComponents(components: ComponentRegistryEntry<any>[]): this {
    this.componentRegistry.registerMany(components)

    return this
  }

  /** Register functions from a registry object */
  registerFunctions(functions: FunctionRegistryObject): this {
    this.functionRegistry.register(functions)

    return this
  }

  /** Add a form to the form engine */
  registerForm(formConfiguration: string | JourneyDefinition): this {
    try {
      const instance = FormInstance.createFromConfiguration(formConfiguration, this.dependencies)

      this.formEngineRouter.mountForm(instance)

      this.forms.set(instance.getFormCode(), instance)

      this.logFormRegistration(instance)
    } catch (e) {
      this.logRegistrationError(e)
    }

    return this
  }

  /**
   * Register a form package (journey + custom functions + components) with optional dependencies.
   *
   * This is a convenience method that registers components, functions, and the form
   * in the correct order.
   *
   * @param pkg - The form package containing journey, registry factory, and optional components
   * @param deps - Dependencies required by the package's createRegistries function (optional for forms with no deps)
   *
   * @example
   * ```typescript
   * // Form with dependencies
   * formEngine.registerFormPackage(myFormPackage, { api: services.apiClient })
   *
   * // Form without dependencies
   * formEngine.registerFormPackage(simpleFormPackage)
   * ```
   */
  registerFormPackage<TDeps>(pkg: FormPackage<TDeps>, deps?: TDeps): this {
    if (pkg.components) {
      this.registerComponents(pkg.components)
    }

    if (pkg.createRegistries) {
      const registries = pkg.createRegistries(deps)
      this.registerFunctions(registries)
    }

    this.registerForm(pkg.journey)

    return this
  }

  private logFormRegistration(instance: FormInstance) {
    const getRoutes = this.formEngineRouter
      .getRegisteredRoutes()
      .filter(route => route.method === 'GET')
      .map(route => route.path)

    const message = [
      { label: 'Form', value: instance.getFormTitle() },
      { label: 'Code', value: instance.getFormCode() },
      { label: 'Routes', value: `${getRoutes.length} registered` },
    ]

    if (getRoutes.length > 0) {
      message.push({ label: 'GET Paths', value: getRoutes.join('\n') })
    }

    this.dependencies.logger.info(formatBox(message, { title: 'FormEngine' }))
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
   * Get the main router that has all registered form routes.
   * The router type depends on the framework adapter used.
   */
  getRouter(): unknown {
    return this.formEngineRouter.getRouter()
  }

  /**
   * Get a specific form instance by its code
   */
  getFormInstance(code: string): FormInstance | undefined {
    return this.forms.get(code)
  }
}

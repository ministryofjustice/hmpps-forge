import type Logger from 'bunyan'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { formatBox } from '@form-engine/logging/formatBox'
import FormInstance from '@form-engine/core/FormInstance'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import express from 'express'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { FunctionRegistryObject } from '@form-engine/registry/types/functions.type'
import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

export interface FormEngineOptions {
  disableBuiltInFunctions?: boolean
  disableBuiltInComponents?: boolean
  basePath?: string
  debug?: boolean
  logger: Logger | Console
}

export default class FormEngine {
  private static readonly DEFAULT_OPTIONS: Required<FormEngineOptions> = {
    disableBuiltInFunctions: false,
    disableBuiltInComponents: false,
    basePath: '/forms',
    debug: false,
    logger: console,
  }

  private readonly options = FormEngine.DEFAULT_OPTIONS

  private readonly functionRegistry = new FunctionRegistry()

  private readonly componentRegistry = new ComponentRegistry()

  private readonly forms = new Map<string, FormInstance>()

  private readonly dependencies: FormInstanceDependencies

  private readonly router = express.Router({ mergeParams: true })

  constructor(constructorOptions: Partial<FormEngineOptions> = {}) {
    this.options = { ...FormEngine.DEFAULT_OPTIONS, ...constructorOptions }

    this.dependencies = {
      functionRegistry: this.functionRegistry,
      componentRegistry: this.componentRegistry,
      logger: this.options.logger,
    }

    if (!this.options.disableBuiltInFunctions) {
      this.functionRegistry.registerBuiltInFunctions()
    }

    if (!this.options.disableBuiltInComponents) {
      this.componentRegistry.registerBuiltInComponents()
    }
  }

  /** Add a new components to the form engine */
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
      const instance = FormInstance.createFromConfiguration(formConfiguration, this.dependencies, this.options)

      this.router.use(this.options.basePath, instance.getRouter())

      this.forms.set(instance.getFormCode(), instance)

      this.logFormRegistration(instance)
    } catch (e) {
      this.logRegistrationError(e)
    }

    return this
  }

  private logFormRegistration(instance: FormInstance) {
    const getRoutes = instance
      .getRegisteredRoutes()
      .filter(route => route.method === 'GET')
      .map(route => `${this.options.basePath}${route.path}`)

    const message = [
      { label: 'Form', value: instance.getFormTitle() },
      { label: 'Code', value: instance.getFormCode() },
      { label: 'Base Path', value: this.options.basePath },
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
   * Get the main Express router that has all registered form routes
   */
  getRouter(): express.Router {
    return this.router
  }

  /**
   * Get a specific form instance by its code
   */
  getFormInstance(code: string): FormInstance | undefined {
    return this.forms.get(code)
  }
}

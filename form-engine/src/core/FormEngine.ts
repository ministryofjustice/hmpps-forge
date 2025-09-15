import type Logger from 'bunyan'
import FunctionRegistry from '@form-engine/core/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/core/registry/ComponentRegistry'
import { RegistryComponent } from '@form-engine/registry/utils/buildComponent'
import { RegistryFunction } from '@form-engine/registry/utils/createRegisterableFunction'
import { FormValidator } from '@form-engine/core/validation/FormValidator'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { isJourneyDefinition } from '@form-engine/form/typeguards/structures'
import { formatBox } from '@form-engine/logging/formatBox'
import FormInstance from '@form-engine/core/FormInstance'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'

export interface FormEngineOptions {
  // TODO: Add some options later
  disableBuiltInFunctions: boolean
  disableBuiltInComponents: boolean
}

export default class FormEngine {
  private static readonly DEFAULT_OPTIONS: Required<FormEngineOptions> = {
    disableBuiltInFunctions: false,
    disableBuiltInComponents: false,
  }

  private readonly functionRegistry = new FunctionRegistry()

  private readonly componentRegistry = new ComponentRegistry()

  private readonly forms = new Map<string, FormInstance>()

  private readonly dependencies: FormInstanceDependencies

  constructor(
    private readonly options: Partial<FormEngineOptions> = {},
    private readonly logger: Logger | Console = console,
  ) {
    this.options = { ...FormEngine.DEFAULT_OPTIONS, ...options }
    this.logger = logger
    this.dependencies = {
      functionRegistry: this.functionRegistry,
      componentRegistry: this.componentRegistry,
      logger: this.logger,
    }

    if (!this.options.disableBuiltInFunctions) {
      this.functionRegistry.registerBuiltInFunctions()
    }

    if (!this.options.disableBuiltInComponents) {
      this.componentRegistry.registerBuiltInComponents()
    }
  }

  /** Add a new components to the form engine */
  registerComponent(component: RegistryComponent<any>) {
    this.componentRegistry.registerMany([component])
  }

  /** Add new components to the form engine */
  registerComponents(components: RegistryComponent<any>[]) {
    this.componentRegistry.registerMany(components)
  }

  /** Add a new condition or transformer to the form engine */
  registerFunction(func: RegistryFunction<any>) {
    this.functionRegistry.registerMany([func])
  }

  /** Add new conditions, transformers to the form engine */
  registerFunctions(functions: RegistryFunction<any>[]) {
    this.functionRegistry.registerMany(functions)
  }

  /** Add a form to the form engine */
  registerForm(formConfiguration: string | JourneyDefinition) {
    let configurationAsObject: JourneyDefinition

    try {
      if (isJourneyDefinition(formConfiguration)) {
        FormValidator.validateJSON(formConfiguration)
        configurationAsObject = formConfiguration
      } else {
        configurationAsObject = JSON.parse(formConfiguration)
      }

      FormValidator.validateSchema(configurationAsObject)

      const instance = new FormInstance(configurationAsObject, this.dependencies, this.options)

      this.forms.set(configurationAsObject.code, instance)

      this.logger.info(
        formatBox(
          `Successfully registered ${configurationAsObject.title} form with path /forms/${configurationAsObject.code}/`,
          { title: 'FormEngine' },
        ),
      )
    } catch (e) {
      if (e instanceof AggregateError) {
        this.logger.error(`${e.message}:`)

        e.errors.forEach(error => {
          this.logger.error(error.toString ? error.toString() : String(error))
        })
      } else {
        this.logger.error(e)
      }
    }
  }
}

import express from 'express'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import type { FormEngineOptions } from '@form-engine/core/FormEngine'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import FormCompilationFactory, { CompiledForm } from '@form-engine/core/ast/FormCompilationFactory'
import { isJourneyDefinition } from '@form-engine/form/typeguards/structures'
import { FormValidator } from '@form-engine/core/validation/FormValidator'
import RouteGenerator from '@form-engine/core/runtime/routes/RouteGenerator'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'

export default class FormInstance {
  private readonly router = express.Router()

  private readonly compiledForm: CompiledForm

  private readonly rawConfiguration: JourneyDefinition

  private readonly registeredRoutes: Array<{ method: string; path: string }> = []

  private constructor(
    formConfiguration: JourneyDefinition,
    private readonly dependencies: FormInstanceDependencies,
    private readonly options?: FormEngineOptions,
  ) {
    this.rawConfiguration = formConfiguration

    const compiler = new FormCompilationFactory()

    this.compiledForm = compiler.compile(formConfiguration)

    this.attachRoutes()
  }

  static createFromConfiguration(
    configuration: any,
    dependencies: FormInstanceDependencies,
    options: FormEngineOptions,
  ) {
    let configurationAsObject

    if (isJourneyDefinition(configuration)) {
      FormValidator.validateJSON(configuration)
      configurationAsObject = configuration
    } else {
      configurationAsObject = JSON.parse(configuration)
    }

    FormValidator.validateSchema(configurationAsObject)

    return new FormInstance(configurationAsObject, dependencies, options)
  }

  /**
   * Generate and attach routes to the Express router
   */
  private attachRoutes(): void {
    const routeGenerator = new RouteGenerator(this.compiledForm, this.dependencies, this.options)
    const { routes } = routeGenerator.generateRoutes()

    routes.forEach(route => {
      this.dependencies.logger.debug(`Registering ${route.method} route: ${route.path}`)

      this.registeredRoutes.push({
        method: route.method,
        path: route.path,
      })

      if (route.method === 'GET') {
        this.router.get(route.path, route.handler)
      } else {
        this.router.post(route.path, route.handler)
      }
    })

    this.dependencies.logger.info(`Successfully registered ${routes.length} routes`)
  }

  getFormCode(): string {
    return this.compiledForm[0].journeyMetadataArtefact.specialisedNodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
      .at(0).properties.code
  }

  getFormTitle(): string {
    return this.rawConfiguration.title
  }

  /**
   * Get the Express router for this form instance
   */
  getRouter(): express.Router {
    return this.router
  }

  /**
   * Get all registered routes for this form instance
   * Returns a copy of the routes array to prevent external modification
   */
  getRegisteredRoutes() {
    return [...this.registeredRoutes]
  }
}

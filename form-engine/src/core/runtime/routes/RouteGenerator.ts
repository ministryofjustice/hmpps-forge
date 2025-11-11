import express from 'express'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { FormEngineOptions } from '@form-engine/core/FormEngine'
import { CompiledForm, StepArtefact } from '@form-engine/core/ast/FormCompilationFactory'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { StepASTNode } from '@form-engine/core/types/structures.type'

export interface GeneratedRoute {
  path: string
  method: 'GET' | 'POST'
  stepArtefact: StepArtefact
  handler: express.RequestHandler
  isDebugRoute: boolean
}

export interface RouteGenerationResult {
  routes: GeneratedRoute[]
  routeMap: Map<string, StepArtefact>
}

/**
 * Generates Express routes from a CompiledForm
 * Iterates over step artefacts and creates GET/POST routes for each step
 */
export default class RouteGenerator {
  private routes: GeneratedRoute[] = []

  private routeMap: Map<string, StepArtefact> = new Map()

  constructor(
    private readonly compiledForm: CompiledForm,
    private readonly dependencies: FormInstanceDependencies,
    private readonly options: FormEngineOptions,
  ) {}

  /**
   * Generate all routes from the compiled form
   */
  generateRoutes(): RouteGenerationResult {
    // Iterate over all step artefacts
    this.compiledForm.forEach(artefact => {
      this.handleStepArtefact(artefact.stepArtefact)
    })

    return {
      routes: this.routes,
      routeMap: this.routeMap,
    }
  }

  /**
   * Handle a step artefact - create routes for it
   */
  private handleStepArtefact(stepArtefact: StepArtefact): void {
    // TODO: For now, just find the step artefact. When thunks etc are done,
    //  we'll export a more complete chunk of data about a step which we can use here
    const path = stepArtefact.specialisedNodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
      .at(0).properties.get('path')

    if (this.routeMap.has(path)) {
      this.dependencies.logger.warn(`Duplicate route path detected: ${path}`)
      return
    }

    this.routeMap.set(path, stepArtefact)

    const getRoute = this.createRoute(path, 'GET', stepArtefact)
    const postRoute = this.createRoute(path, 'POST', stepArtefact)

    this.routes.push(getRoute, postRoute)
  }

  /**
   * Create a route with its handler
   */
  private createRoute(path: string, method: 'GET' | 'POST', artefact: StepArtefact): GeneratedRoute {
    const handler = this.createHandler(method)

    return {
      path,
      method,
      stepArtefact: artefact,
      handler,
      isDebugRoute: false,
    }
  }

  /**
   * Create an Express request handler for a route
   */
  private createHandler(method: 'GET' | 'POST'): express.RequestHandler {
    return async (req, res, next) => {

      try {
        if (method === 'GET') {
          // For GET requests, render the step
          // This will be implemented by the form engine's rendering logic
          this.dependencies.logger.debug(`GET request to step at path ${req.path}`)

          // TODO: Placeholder response - actual implementation will render the step
          res.json({
            message: 'Form rendering not yet implemented',
            path: req.path,
          })
        }

        if (method === 'POST') {
          // For POST requests, handle form submission and transitions
          this.dependencies.logger.debug(`POST request to step at path ${req.path}`)

          // TODO: Placeholder response - actual implementation will process submission
          res.json({
            message: 'Form submission not yet implemented',
            path: req.path,
            body: req.body,
          })
        }

        // TODO: Add proper HTTP errors?
        next(new Error('Unsupported method, request must be either a GET or a POST'))
      } catch (error) {
        next(error)
      }
    }
  }
}

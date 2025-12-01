import express from 'express'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { FormEngineOptions } from '@form-engine/core/FormEngine'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { CompilationArtefact, CompiledForm } from '@form-engine/core/ast/compilation/FormCompilationFactory'

export interface GeneratedRoute {
  path: string
  method: 'GET' | 'POST'
  artefact: CompilationArtefact
  handler: express.RequestHandler
  isDebugRoute: boolean
}

export interface RouteGenerationResult {
  routes: GeneratedRoute[]
  routeMap: Map<string, CompilationArtefact>
}

/**
 * Generates Express routes from a CompiledForm
 * Iterates over step artefacts and creates GET/POST routes for each step
 */
export default class RouteGenerator {
  private routes: GeneratedRoute[] = []

  private routeMap: Map<string, CompilationArtefact> = new Map()

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
    this.compiledForm.forEach(({ artefact }) => {
      this.handleStepArtefact(artefact)
    })

    return {
      routes: this.routes,
      routeMap: this.routeMap,
    }
  }

  /**
   * Handle a step artefact - create routes for it
   */
  private handleStepArtefact(artefact: CompilationArtefact): void {
    const stepNode = artefact.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP).at(0)

    if (!stepNode) {
      this.dependencies.logger.warn('No step node found in artefact')
      return
    }

    const path = stepNode.properties.path

    if (this.routeMap.has(path)) {
      this.dependencies.logger.warn(`Duplicate route path detected: ${path}`)
      return
    }

    this.routeMap.set(path, artefact)

    const getRoute = this.createRoute(path, 'GET', artefact)
    const postRoute = this.createRoute(path, 'POST', artefact)

    this.routes.push(getRoute, postRoute)
  }

  /**
   * Create a route with its handler
   */
  private createRoute(path: string, method: 'GET' | 'POST', artefact: CompilationArtefact): GeneratedRoute {
    const handler = this.createHandler(method)

    return {
      path,
      method,
      artefact,
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

          return
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

          return
        }

        next(new Error('Unsupported method, request must be either a GET or a POST'))
      } catch (error) {
        next(error)
      }
    }
  }
}

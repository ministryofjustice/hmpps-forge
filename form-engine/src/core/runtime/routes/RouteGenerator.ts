import express from 'express'
import {
  structuralTraverse,
  StructuralVisitor,
  StructuralVisitResult,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import CompiledAST from '@form-engine/core/ast/CompiledAST'
import { FormInstanceDependencies, ASTNode } from '@form-engine/core/types/engine.type'
import { isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { FormEngineOptions } from '@form-engine/core/FormEngine'

export interface GeneratedRoute {
  path: string
  method: 'GET' | 'POST'
  stepNode?: StepASTNode
  journeyNode?: JourneyASTNode
  handler: express.RequestHandler
  isDebugRoute: boolean
}

export interface RouteGenerationResult {
  routes: GeneratedRoute[]
  routeMap: Map<string, StepASTNode>
}

/**
 * Generates Express routes from a CompiledAST by traversing the journey and step structure.
 * Uses the StructuralTraverser to walk through the AST and collect route information.
 */
export default class RouteGenerator {
  private routes: GeneratedRoute[] = []

  private routeMap: Map<string, StepASTNode> = new Map()

  private journeyPathStack: string[] = []

  private currentJourney: JourneyASTNode | null = null

  constructor(
    private readonly compiledAst: CompiledAST,
    private readonly dependencies: FormInstanceDependencies,
    private readonly options: FormEngineOptions,
  ) {}

  /**
   * Generate all routes from the compiled AST
   */
  generateRoutes(): RouteGenerationResult {
    const visitor = this.createVisitor()
    structuralTraverse(this.compiledAst.getRoot(), visitor)

    return {
      routes: this.routes,
      routeMap: this.routeMap,
    }
  }

  /**
   * Create a StructuralVisitor that collects route information
   */
  private createVisitor(): StructuralVisitor {
    return {
      enterNode: (node: ASTNode) => {
        if (isJourneyStructNode(node)) {
          this.handleJourneyEnter(node)
        }

        if (isStepStructNode(node)) {
          this.handleStep(node)
        }

        return StructuralVisitResult.CONTINUE
      },

      exitNode: (node: ASTNode) => {
        if (isJourneyStructNode(node)) {
          this.handleJourneyExit()
        }

        return StructuralVisitResult.CONTINUE
      },
    }
  }

  /**
   * Handle entering a journey node - push its path to the stack
   */
  private handleJourneyEnter(journey: JourneyASTNode) {
    this.currentJourney = journey
    const journeyPath = journey.properties.get('path')

    if (journeyPath) {
      this.journeyPathStack.push(this.normalizePath(journeyPath))
    }
  }

  /**
   * Handle exiting a journey node - pop its path from the stack
   */
  private handleJourneyExit() {
    const journey = this.currentJourney

    if (journey) {
      const journeyPath = journey.properties.get('path')

      if (journeyPath) {
        this.journeyPathStack.pop()
      }
    }
  }

  /**
   * Handle a step node - create routes for it
   */
  private handleStep(step: StepASTNode) {
    const stepPath = step.properties.get('path') as string

    if (!stepPath) {
      this.dependencies.logger.warn(`Step node ${step.id} has no path defined`)
      return
    }

    const fullPath = this.buildFullPath(stepPath)

    if (this.routeMap.has(fullPath)) {
      this.dependencies.logger.warn(`Duplicate route path detected: ${fullPath}`)
      return
    }

    this.routeMap.set(fullPath, step)

    const getRoute = this.createRoute(fullPath, 'GET', step)
    const postRoute = this.createRoute(fullPath, 'POST', step)

    this.routes.push(getRoute, postRoute)
  }

  /**
   * Build the full path by combining journey paths with step path
   */
  private buildFullPath(stepPath: string): string {
    const normalizedStepPath = this.normalizePath(stepPath)

    if (this.journeyPathStack.length === 0) {
      return normalizedStepPath
    }

    const journeyPath = this.journeyPathStack.join('')
    return `${journeyPath}${normalizedStepPath}`
  }

  /**
   * Normalize a path segment to ensure it starts with /
   */
  private normalizePath(path: string): string {
    if (!path) {
      return ''
    }

    if (!path.startsWith('/')) {
      return `/${path}`
    }

    return path
  }

  /**
   * Create a route with its handler
   */
  private createRoute(path: string, method: 'GET' | 'POST', stepNode: StepASTNode): GeneratedRoute {
    const handler = this.createHandler(method, stepNode)

    return {
      path,
      method,
      stepNode,
      journeyNode: this.currentJourney!,
      handler,
      isDebugRoute: false,
    }
  }

  /**
   * Create an Express request handler for a route
   */
  private createHandler(method: 'GET' | 'POST', stepNode: StepASTNode): express.RequestHandler {
    return async (req, res, next) => {
      try {
        // TODO: Come back and change this to be in its own property
        // Store the step node in the request for use by the rest of the form engine
        ;(req as any).stepNode = stepNode
        ;(req as any).journeyNode = this.currentJourney
        ;(req as any).compiledAst = this.compiledAst

        if (method === 'GET') {
          // For GET requests, render the step
          // This will be implemented by the form engine's rendering logic
          this.dependencies.logger.debug(`GET request to step ${stepNode.id} at path ${req.path}`)

          // TODO: Placeholder response - actual implementation will render the step
          res.json({
            message: 'Form rendering not yet implemented',
            nodeId: stepNode.id,
            path: req.path,
          })
        }

        if (method === 'POST') {
          // For POST requests, handle form submission and transitions
          this.dependencies.logger.debug(`POST request to step ${stepNode.id} at path ${req.path}`)

          // TODO: Placeholder response - actual implementation will process submission
          res.json({
            message: 'Form submission not yet implemented',
            nodeId: stepNode.id,
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

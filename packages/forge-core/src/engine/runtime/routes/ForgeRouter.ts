import { CompilationArtefact } from '../../compilation/CompilationFactory'
import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { ForgeOptions } from '../../Forge'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import type { JourneyDefinition, StepDefinition } from '../../../authoring/types/structures.type'
import { joinPaths, normalizeBasePath } from '../../../framework/path/routePath'
import { JourneyMetadata, StepMetadata } from '../../../framework/rendering/types'
import StepController from './StepController'
import getAncestorChain from '../../utils/getAncestorChain'
import { isJourneyStructNode } from '../../typeguards/structure-nodes'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import type JourneyInstance from '../../JourneyInstance'
import { JourneyRouteTemplateCatalog, RouteMapEntry, StepMountContext } from '../types/routes.type'

/**
 * Unified routing and navigation service for forge.
 *
 * Handles:
 * - Route mounting for all journey steps (GET/POST handlers)
 * - Navigation metadata storage for all registered journeys
 *
 * Owns the main router - Forge delegates router access to this class.
 *
 * @typeParam TRouter - Framework-specific router type
 */
export default class ForgeRouter<TRouter> {
  private readonly router: TRouter

  private readonly basePath: string

  private readonly routeMap: Map<string, RouteMapEntry> = new Map()

  private readonly registeredRoutes: Array<{ method: 'GET' | 'POST'; path: string }> = []

  private readonly journeyRouters: Map<string, TRouter> = new Map()

  private readonly navigationMetadata: JourneyMetadata[] = []

  constructor(
    private readonly dependencies: JourneyInstanceDependencies,
    options: ForgeOptions,
  ) {
    this.router = dependencies.frameworkAdapter.createRouter()
    this.basePath = normalizeBasePath(options.basePath)
  }

  /**
   * Mount a journey's routes and store its navigation metadata.
   *
   * Called by Forge after creating a JourneyInstance. Registers GET/POST routes
   * for each step and stores the journey structure for navigation.
   *
   * @param journeyInstance - Journey instance containing compiled journey and configuration
   */
  mount(journeyInstance: JourneyInstance, journeyDependencies?: JourneyInstanceDependencies): void {
    const stepIndex = journeyInstance.getStepIndex()
    const sharedArtefact = journeyInstance.getSharedCompilationArtefact()
    const config = journeyInstance.getConfiguration()
    const routeTemplateContexts = this.buildRouteTemplateContexts(stepIndex, sharedArtefact)
    const stepDependencies = journeyDependencies ?? this.dependencies

    stepIndex.forEach((stepNode, stepId) => {
      const routeTemplateContext = routeTemplateContexts.get(stepId)

      if (!routeTemplateContext) {
        throw new Error(`Unable to resolve route template context for step ${stepId}`)
      }

      this.mountStep(this.router, {
        stepId,
        stepNode,
        sharedArtefact,
        resolveCompiledStep: () => journeyInstance.getCompiledStep(stepId),
        routeTemplatePath: routeTemplateContext.routeTemplatePath,
        routeTemplateCatalog: routeTemplateContext.routeTemplateCatalog,
        dependencies: stepDependencies,
      })
    })

    this.storeNavigationMetadata(config)
  }

  /**
   * Get the main router with all mounted routes.
   */
  getRouter(): TRouter {
    return this.router
  }

  /**
   * Get all registered routes across all mounted journeys.
   */
  getRegisteredRoutes(): Array<{ method: 'GET' | 'POST'; path: string }> {
    return this.registeredRoutes
  }

  /**
   * Get stored navigation metadata for all registered journeys.
   * Used by RenderContextFactory to build navigation trees with active state.
   */
  getNavigationMetadata(): JourneyMetadata[] {
    return this.navigationMetadata
  }

  /**
   * Mount a single step as GET and POST routes
   */
  private mountStep(rootRouter: TRouter, stepMountContext: StepMountContext): void {
    const { stepId, stepNode, sharedArtefact, resolveCompiledStep, routeTemplateCatalog, routeTemplatePath } =
      stepMountContext
    const journeyAncestry = this.getJourneyAncestry(stepId, sharedArtefact)
    const { router, basePath } = this.getOrCreateJourneyRouter(rootRouter, journeyAncestry)

    const stepPath = stepNode.properties.path
    const fullPath = joinPaths(basePath, stepPath)

    if (this.routeMap.has(fullPath)) {
      throw new DuplicateRouteError({ path: fullPath })
    }

    this.routeMap.set(fullPath, { stepId, resolveCompiledStep })

    let controller: StepController<unknown, unknown> | undefined

    const getController = () => {
      if (!controller) {
        controller = new StepController(
          resolveCompiledStep(),
          stepMountContext.dependencies,
          this.navigationMetadata,
          routeTemplatePath,
          routeTemplateCatalog,
        )
      }

      return controller
    }

    this.dependencies.frameworkAdapter.get(router, stepPath, (req, res) => getController().get(req, res))
    this.registeredRoutes.push({ method: 'GET', path: fullPath })

    this.dependencies.frameworkAdapter.post(router, stepPath, (req, res) => getController().post(req, res))
    this.registeredRoutes.push({ method: 'POST', path: fullPath })
  }

  /**
   * Extract journey ancestry for a step
   */
  private getJourneyAncestry(stepId: NodeId, artefact: CompilationArtefact): JourneyASTNode[] {
    const chain = getAncestorChain(stepId, artefact.metadataRegistry)

    return chain
      .filter(nodeId => nodeId !== stepId)
      .map(nodeId => artefact.nodeRegistry.get(nodeId))
      .filter(isJourneyStructNode)
  }

  private buildRouteTemplateContexts(
    stepIndex: Map<NodeId, StepASTNode>,
    artefact: CompilationArtefact,
  ): Map<NodeId, { routeTemplatePath: string; routeTemplateCatalog: JourneyRouteTemplateCatalog }> {
    const catalogsByJourneyBasePath = new Map<string, JourneyRouteTemplateCatalog>()
    const contextsByStepId = new Map<
      NodeId,
      { routeTemplatePath: string; routeTemplateCatalog: JourneyRouteTemplateCatalog }
    >()

    stepIndex.forEach((stepNode, stepId) => {
      const journeyAncestry = this.getJourneyAncestry(stepId, artefact)
      const journeyBasePath = this.getJourneyBasePath(journeyAncestry)
      const routeTemplatePath = joinPaths(journeyBasePath, stepNode.properties.path)
      const routeTemplateCatalog = catalogsByJourneyBasePath.get(journeyBasePath) ?? {
        routeTemplatePathByStepId: new Map<NodeId, string>(),
        stepIdByRouteTemplatePath: new Map<string, NodeId>(),
      }

      routeTemplateCatalog.routeTemplatePathByStepId.set(stepId, routeTemplatePath)
      routeTemplateCatalog.stepIdByRouteTemplatePath.set(routeTemplatePath, stepId)
      catalogsByJourneyBasePath.set(journeyBasePath, routeTemplateCatalog)
      contextsByStepId.set(stepId, { routeTemplatePath, routeTemplateCatalog })
    })

    return contextsByStepId
  }

  private getJourneyBasePath(journeyAncestry: JourneyASTNode[]): string {
    return journeyAncestry.reduce((path, journey) => joinPaths(path, journey.properties.path), this.basePath)
  }

  /**
   * Get or create nested routers for a journey ancestry chain
   */
  private getOrCreateJourneyRouter(
    rootRouter: TRouter,
    journeyAncestry: JourneyASTNode[],
  ): { router: TRouter; basePath: string } {
    let currentRouter = rootRouter
    let basePath = this.basePath

    journeyAncestry.forEach(journey => {
      const journeyPath = journey.properties.path
      basePath = joinPaths(basePath, journeyPath)

      if (!this.journeyRouters.has(basePath)) {
        const newRouter = this.dependencies.frameworkAdapter.createRouter()

        // First level mounts at basePath + journeyPath, nested levels just use journeyPath
        const mountPath =
          currentRouter === rootRouter ? joinPaths(this.basePath, journeyPath) : joinPaths('', journeyPath)

        this.dependencies.frameworkAdapter.mountRouter(currentRouter, mountPath, newRouter)
        this.journeyRouters.set(basePath, newRouter)

        this.mountJourneyRedirectHandler(newRouter, basePath, journey)
      }

      currentRouter = this.journeyRouters.get(basePath)!
    })

    return { router: currentRouter, basePath }
  }

  /**
   * Mount a redirect handler at the journey root path
   */
  private mountJourneyRedirectHandler(router: TRouter, basePath: string, journey: JourneyASTNode): void {
    const entryPath = this.resolveJourneyEntryPath(basePath, journey)

    if (entryPath && entryPath !== basePath) {
      this.dependencies.frameworkAdapter.registerRedirect(router, '/', entryPath)
    }
  }

  /**
   * Resolve the entry path for a journey
   * Priority: 1) entryPath property, 2) first step with isEntryPoint: true
   */
  private resolveJourneyEntryPath(basePath: string, journey: JourneyASTNode): string | null {
    if (journey.properties.entryPath) {
      return joinPaths(basePath, journey.properties.entryPath)
    }

    const entryPointStep = journey.properties.steps?.find(step => step.properties.isEntryPoint)

    if (entryPointStep) {
      return joinPaths(basePath, entryPointStep.properties.path)
    }

    return null
  }

  /**
   * Store navigation metadata from journey definition
   */
  private storeNavigationMetadata(config: JourneyDefinition): void {
    const metadata = this.extractJourneyMetadata(config, this.basePath)

    this.navigationMetadata.push(metadata)
  }

  /**
   * Extract navigation metadata from a journey definition recursively
   */
  private extractJourneyMetadata(journey: JourneyDefinition, parentPath: string): JourneyMetadata {
    const journeyPath = joinPaths(parentPath, journey.path)
    const children: Array<JourneyMetadata | StepMetadata> = []

    journey.steps?.forEach(step => {
      children.push(this.extractStepMetadata(step, journeyPath))
    })

    journey.children?.forEach(childJourney => {
      children.push(this.extractJourneyMetadata(childJourney, journeyPath))
    })

    return {
      title: journey.title,
      description: journey.description,
      path: journeyPath,
      metadata: journey.metadata,
      children,
    }
  }

  /**
   * Extract navigation metadata from a step definition
   */
  private extractStepMetadata(step: StepDefinition, parentPath: string): StepMetadata {
    return {
      title: step.title,
      path: joinPaths(parentPath, step.path),
      metadata: step.metadata,
    }
  }
}

import { CompilationArtefact } from '../../compilation/CompilationFactory'
import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { ForgeOptions } from '../../Forge'
import { JourneyASTNode } from '../../types/structures.type'
import type { JourneyDefinition, StepDefinition } from '../../../authoring/types/structures.type'
import { JourneyMetadata, StepMetadata } from '../../../framework/rendering/types'
import StepController from './StepController'
import getAncestorChain from '../../utils/getAncestorChain'
import { isJourneyStructNode } from '../../typeguards/structure-nodes'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import type JourneyInstance from '../../JourneyInstance'
import { RouteMapEntry, StepMountContext } from './types'

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
    this.basePath = this.normalizeBasePath(options.basePath)
  }

  /**
   * Normalize basePath to ensure consistent format.
   * - Empty string if not provided
   * - Ensure leading slash
   * - Remove trailing slash
   */
  private normalizeBasePath(basePath?: string): string {
    if (!basePath) {
      return ''
    }

    let normalized = basePath

    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`
    }

    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }

    return normalized
  }

  /**
   * Mount a journey's routes and store its navigation metadata.
   *
   * Called by Forge after creating a JourneyInstance. Registers GET/POST routes
   * for each step and stores the journey structure for navigation.
   *
   * @param journeyInstance - Journey instance containing compiled journey and configuration
   */
  mount(journeyInstance: JourneyInstance): void {
    const stepIndex = journeyInstance.getStepIndex()
    const sharedArtefact = journeyInstance.getSharedCompilationArtefact()
    const config = journeyInstance.getConfiguration()

    stepIndex.forEach((stepNode, stepId) => {
      this.mountStep(this.router, {
        stepId,
        stepNode,
        sharedArtefact,
        resolveCompiledStep: () => journeyInstance.getCompiledStep(stepId),
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
    const { stepId, stepNode, sharedArtefact, resolveCompiledStep } = stepMountContext
    const journeyAncestry = this.getJourneyAncestry(stepId, sharedArtefact)
    const { router, basePath } = this.getOrCreateJourneyRouter(rootRouter, journeyAncestry)

    const stepPath = stepNode.properties.path
    const fullPath = basePath + stepPath

    if (this.routeMap.has(fullPath)) {
      throw new DuplicateRouteError({ path: fullPath })
    }

    this.routeMap.set(fullPath, { stepId, resolveCompiledStep })

    this.dependencies.frameworkAdapter.get(router, stepPath, async (req, res) => {
      const compiledStep = await resolveCompiledStep()
      const controller = new StepController(compiledStep, this.dependencies, this.navigationMetadata, fullPath)

      return controller.get(req, res)
    })
    this.registeredRoutes.push({ method: 'GET', path: fullPath })

    this.dependencies.frameworkAdapter.post(router, stepPath, async (req, res) => {
      const compiledStep = await resolveCompiledStep()
      const controller = new StepController(compiledStep, this.dependencies, this.navigationMetadata, fullPath)

      return controller.post(req, res)
    })
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
      basePath += journeyPath

      if (!this.journeyRouters.has(basePath)) {
        const newRouter = this.dependencies.frameworkAdapter.createRouter()

        // First level mounts at basePath + journeyPath, nested levels just use journeyPath
        const mountPath = currentRouter === rootRouter ? this.basePath + journeyPath : journeyPath
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

    if (entryPath) {
      this.dependencies.frameworkAdapter.registerRedirect(router, '/', entryPath)
    }
  }

  /**
   * Resolve the entry path for a journey
   * Priority: 1) entryPath property, 2) first step with isEntryPoint: true
   */
  private resolveJourneyEntryPath(basePath: string, journey: JourneyASTNode): string | null {
    if (journey.properties.entryPath) {
      return basePath + journey.properties.entryPath
    }

    const entryPointStep = journey.properties.steps?.find(step => step.properties.isEntryPoint)

    if (entryPointStep) {
      return basePath + entryPointStep.properties.path
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
    const journeyPath = parentPath + journey.path
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
      hiddenFromNavigation: journey.view?.hiddenFromNavigation,
      children,
    }
  }

  /**
   * Extract navigation metadata from a step definition
   */
  private extractStepMetadata(step: StepDefinition, parentPath: string): StepMetadata {
    return {
      title: step.title,
      path: parentPath + step.path,
      hiddenFromNavigation: step.view?.hiddenFromNavigation,
    }
  }
}

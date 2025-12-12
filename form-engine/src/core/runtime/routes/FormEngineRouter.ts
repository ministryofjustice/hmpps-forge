import { CompilationArtefact, CompiledForm } from '@form-engine/core/ast/compilation/FormCompilationFactory'
import { FormInstanceDependencies, NodeId } from '@form-engine/core/types/engine.type'
import { FormEngineOptions } from '@form-engine/core/FormEngine'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { JourneyDefinition, StepDefinition } from '@form-engine/form/types/structures.type'
import { JourneyMetadata, StepMetadata } from '@form-engine/core/runtime/rendering/types'
import FormStepController from '@form-engine/core/runtime/routes/FormStepController'
import getAncestorChain from '@form-engine/core/ast/utils/getAncestorChain'
import { isJourneyStructNode } from '@form-engine/core/typeguards/structure-nodes'
import DuplicateRouteError from '@form-engine/errors/DuplicateRouteError'
import type FormInstance from '@form-engine/core/FormInstance'

/**
 * Unified routing and navigation service for the form engine.
 *
 * Handles:
 * - Route mounting for all form steps (GET/POST handlers)
 * - Navigation metadata storage for all registered forms
 *
 * Owns the main router - FormEngine delegates router access to this class.
 *
 * @typeParam TRouter - Framework-specific router type
 */
export default class FormEngineRouter<TRouter> {
  private readonly router: TRouter

  private readonly basePath: string

  private readonly routeMap: Map<string, CompilationArtefact> = new Map()

  private readonly registeredRoutes: Array<{ method: 'GET' | 'POST'; path: string }> = []

  private readonly journeyRouters: Map<string, TRouter> = new Map()

  private readonly navigationMetadata: JourneyMetadata[] = []

  constructor(
    private readonly dependencies: FormInstanceDependencies,
    private readonly options: FormEngineOptions,
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
   * Mount a form's routes and store its navigation metadata.
   *
   * Called by FormEngine after creating a FormInstance. Registers GET/POST routes
   * for each step and stores the journey structure for navigation.
   *
   * @param formInstance - Form instance containing compiled form and configuration
   */
  mountForm(formInstance: FormInstance): void {
    const compiledForm = formInstance.getCompiledForm()
    const config = formInstance.getConfiguration()

    compiledForm.forEach(compiled => this.mountStep(this.router, compiled))

    this.storeNavigationMetadata(config)

    this.dependencies.logger.info(`[FormEngineRouter]: Successfully registered routes for form: ${config.code}`)
  }

  /**
   * Get the main router with all mounted form routes.
   */
  getRouter(): TRouter {
    return this.router
  }

  /**
   * Get all registered routes across all mounted forms.
   */
  getRegisteredRoutes(): Array<{ method: 'GET' | 'POST'; path: string }> {
    return this.registeredRoutes
  }

  /**
   * Get stored navigation metadata for all registered forms.
   * Used by RenderContextFactory to build navigation trees with active state.
   */
  getNavigationMetadata(): JourneyMetadata[] {
    return this.navigationMetadata
  }

  /**
   * Mount a single step as GET and POST routes
   */
  private mountStep(rootRouter: TRouter, compiledForm: CompiledForm[number]): void {
    const step = compiledForm.artefact.nodeRegistry.get(compiledForm.currentStepId) as StepASTNode
    const journeyAncestry = this.getJourneyAncestry(compiledForm.currentStepId, compiledForm.artefact)
    const { router, basePath } = this.getOrCreateJourneyRouter(rootRouter, journeyAncestry)

    const stepPath = step.properties.path
    const fullPath = basePath + stepPath

    if (this.routeMap.has(fullPath)) {
      throw new DuplicateRouteError({ path: fullPath })
    }

    this.routeMap.set(fullPath, compiledForm.artefact)

    const controller = new FormStepController(compiledForm, this.dependencies, this.navigationMetadata, fullPath)

    this.dependencies.frameworkAdapter.get(router, stepPath, controller.get.bind(controller))
    this.registeredRoutes.push({ method: 'GET', path: fullPath })
    this.dependencies.logger.debug(`[FormEngineRouter]: Registered GET route: ${fullPath}`)

    this.dependencies.frameworkAdapter.post(router, stepPath, controller.post.bind(controller))
    this.registeredRoutes.push({ method: 'POST', path: fullPath })
    this.dependencies.logger.debug(`[FormEngineRouter]: Registered POST route: ${fullPath}`)
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
      this.dependencies.logger.debug(`[FormEngineRouter]: Registered redirect handler: ${basePath}`)
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

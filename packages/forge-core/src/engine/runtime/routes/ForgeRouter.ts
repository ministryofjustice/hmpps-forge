import { CompilationArtefact, JourneyIndex } from '../../compilation/CompilationFactory'
import { JourneyInstanceDependencies, NodeId } from '../../types/engine.type'
import { ForgeOptions } from '../../Forge'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import type { JourneyDefinition, StepDefinition } from '../../../authoring/types/structures.type'
import { joinPaths, normalizeBasePath } from '../../../framework/path/routePath'
import { JourneyMetadata, StepMetadata } from '../../../framework/rendering/types'
import StepController from './StepController'
import JourneyController from './JourneyController'
import getAncestorChain from '../../utils/getAncestorChain'
import { isJourneyStructNode } from '../../typeguards/structure-nodes'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import type JourneyInstance from '../../JourneyInstance'
import { JourneyRouteTemplateCatalog, RouteMapEntry } from './routes.type'

interface StepRouteContext {
  stepId: NodeId
  stepNode: StepASTNode
  routeTemplatePath: string
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  journeyBasePath: string
}

export default class ForgeRouter<TRouter> {
  private readonly router: TRouter

  private readonly basePath: string

  private readonly routeMap: Map<string, RouteMapEntry> = new Map()

  private readonly registeredRoutes: Array<{ method: 'GET' | 'POST'; path: string }> = []

  private readonly journeyRouters = new Map<string, { router: TRouter; journeyNode: JourneyASTNode }>()

  private readonly navigationMetadata: JourneyMetadata[] = []

  constructor(
    private readonly dependencies: JourneyInstanceDependencies,
    options: ForgeOptions,
  ) {
    this.router = dependencies.frameworkAdapter.createRouter()
    this.basePath = normalizeBasePath(options.basePath)
  }

  mount(journeyInstance: JourneyInstance, journeyDependencies?: JourneyInstanceDependencies): void {
    const stepIndex = journeyInstance.getStepIndex()
    const journeyIndex = journeyInstance.getJourneyIndex()
    const artefact = journeyInstance.getSharedCompilationArtefact()
    const deps = journeyDependencies ?? this.dependencies

    const { stepContexts, catalogsByBasePath } = this.buildStepRouteContexts(stepIndex, artefact)

    this.createJourneyRouters(journeyIndex, artefact)
    this.mountStepRoutes(stepContexts, journeyInstance, deps)
    this.mountJourneyRootHandlers(journeyInstance, catalogsByBasePath, deps)
    this.storeNavigationMetadata(journeyInstance.getConfiguration())
  }

  getRouter(): TRouter {
    return this.router
  }

  getRegisteredRoutes(): Array<{ method: 'GET' | 'POST'; path: string }> {
    return this.registeredRoutes
  }

  getNavigationMetadata(): JourneyMetadata[] {
    return this.navigationMetadata
  }

  // ── Pass 1: Compute route paths and catalogs ─────────────────────

  private buildStepRouteContexts(
    stepIndex: Map<NodeId, StepASTNode>,
    artefact: CompilationArtefact,
  ): {
    stepContexts: StepRouteContext[]
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>
  } {
    const catalogsByBasePath = new Map<string, JourneyRouteTemplateCatalog>()
    const stepContexts: StepRouteContext[] = []

    stepIndex.forEach((stepNode, stepId) => {
      const journeyAncestry = this.getJourneyAncestry(stepId, artefact)
      const journeyBasePath = this.getJourneyBasePath(journeyAncestry)
      const routeTemplatePath = joinPaths(journeyBasePath, stepNode.properties.path)
      const routeTemplateCatalog = catalogsByBasePath.get(journeyBasePath) ?? {
        routeTemplatePathByStepId: new Map<NodeId, string>(),
        stepIdByRouteTemplatePath: new Map<string, NodeId>(),
      }

      routeTemplateCatalog.routeTemplatePathByStepId.set(stepId, routeTemplatePath)
      routeTemplateCatalog.stepIdByRouteTemplatePath.set(routeTemplatePath, stepId)
      catalogsByBasePath.set(journeyBasePath, routeTemplateCatalog)

      stepContexts.push({ stepId, stepNode, routeTemplatePath, routeTemplateCatalog, journeyBasePath })
    })

    return { stepContexts, catalogsByBasePath }
  }

  // ── Pass 2: Create journey sub-routers ────────────────────────────

  private createJourneyRouters(journeyIndex: JourneyIndex, artefact: CompilationArtefact): void {
    journeyIndex.forEach((_, journeyId) => {
      const chain = getAncestorChain(journeyId, artefact.metadataRegistry)
        .map(id => artefact.nodeRegistry.get(id))
        .filter(isJourneyStructNode)

      let currentRouter = this.router
      let basePath = this.basePath

      chain.forEach(journey => {
        const journeyPath = journey.properties.path
        basePath = joinPaths(basePath, journeyPath)

        if (!this.journeyRouters.has(basePath)) {
          const newRouter = this.dependencies.frameworkAdapter.createRouter()
          const mountPath =
            currentRouter === this.router ? joinPaths(this.basePath, journeyPath) : joinPaths('', journeyPath)

          this.dependencies.frameworkAdapter.mountRouter(currentRouter, mountPath, newRouter)
          this.journeyRouters.set(basePath, { router: newRouter, journeyNode: journey })
        }

        currentRouter = this.journeyRouters.get(basePath)!.router
      })
    })
  }

  // ── Pass 3: Mount step routes ─────────────────────────────────────

  private mountStepRoutes(
    stepContexts: StepRouteContext[],
    journeyInstance: JourneyInstance,
    dependencies: JourneyInstanceDependencies,
  ): void {
    stepContexts.forEach(ctx => {
      const router = this.journeyRouters.get(ctx.journeyBasePath)!.router
      const stepPath = ctx.stepNode.properties.path
      const fullPath = joinPaths(ctx.journeyBasePath, stepPath)

      if (this.routeMap.has(fullPath)) {
        throw new DuplicateRouteError({ path: fullPath })
      }

      const resolveCompiledStep = () => journeyInstance.getCompiledStep(ctx.stepId)

      this.routeMap.set(fullPath, { stepId: ctx.stepId, resolveCompiledStep })

      let controller: StepController<unknown, unknown> | undefined

      const getController = () => {
        if (!controller) {
          controller = new StepController(
            resolveCompiledStep(),
            dependencies,
            this.navigationMetadata,
            ctx.routeTemplatePath,
            ctx.routeTemplateCatalog,
          )
        }

        return controller
      }

      this.dependencies.frameworkAdapter.get(router, stepPath, (req, res) => getController().get(req, res))
      this.registeredRoutes.push({ method: 'GET', path: fullPath })

      this.dependencies.frameworkAdapter.post(router, stepPath, (req, res) => getController().post(req, res))
      this.registeredRoutes.push({ method: 'POST', path: fullPath })
    })
  }

  // ── Pass 4: Mount journey root handlers ───────────────────────────

  private mountJourneyRootHandlers(
    journeyInstance: JourneyInstance,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    dependencies: JourneyInstanceDependencies,
  ): void {
    this.journeyRouters.forEach(({ router, journeyNode }, basePath) => {
      const journeyPlan = journeyInstance.getJourneyRuntimePlan(journeyNode.id)
      const routeTemplateCatalog = catalogsByBasePath.get(basePath)

      if (!journeyPlan || !routeTemplateCatalog) {
        return
      }

      let controller: JourneyController<unknown, unknown> | undefined

      const getController = () => {
        if (!controller) {
          controller = new JourneyController(
            journeyPlan,
            journeyInstance.getJourneyCompilationArtefact(),
            dependencies,
            routeTemplateCatalog,
          )
        }

        return controller
      }

      this.dependencies.frameworkAdapter.get(router, '/', (req, res) => getController().get(req, res))
      this.registeredRoutes.push({ method: 'GET', path: basePath })
    })
  }

  // ── Pass 5: Store navigation metadata ─────────────────────────────

  private storeNavigationMetadata(config: JourneyDefinition): void {
    this.navigationMetadata.push(this.extractJourneyMetadata(config, this.basePath))
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private getJourneyAncestry(stepId: NodeId, artefact: CompilationArtefact): JourneyASTNode[] {
    return getAncestorChain(stepId, artefact.metadataRegistry)
      .filter(nodeId => nodeId !== stepId)
      .map(nodeId => artefact.nodeRegistry.get(nodeId))
      .filter(isJourneyStructNode)
  }

  private getJourneyBasePath(journeyAncestry: JourneyASTNode[]): string {
    return journeyAncestry.reduce((path, journey) => joinPaths(path, journey.properties.path), this.basePath)
  }

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

  private extractStepMetadata(step: StepDefinition, parentPath: string): StepMetadata {
    return {
      title: step.title,
      path: joinPaths(parentPath, step.path),
      metadata: step.metadata,
    }
  }
}

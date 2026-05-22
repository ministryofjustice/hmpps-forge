import { ForgeDependencies, PackageDependencies } from '../../types/engine.type'
import { ForgeOptions } from '../../Forge'
import { JourneyASTNode } from '../../types/structures.type'
import { joinPaths, normalizeBasePath } from '../../../framework/path/routePath'
import StepController from './StepController'
import JourneyController from './JourneyController'
import type JourneyInstance from '../../JourneyInstance'
import {
  createRouteTreeIndex,
  JourneyRouteContext,
  JourneyRouteTemplateCatalog,
  RouteTreeIndex,
  StepRouteContext,
  StoredRouteTree,
} from '../types/routes.type'
import RouteTreeBuilder from './RouteTreeBuilder'

export default class ForgeRouter<TRouter> {
  private readonly router: TRouter

  private readonly basePath: string

  private readonly routeTreeIndex: RouteTreeIndex = createRouteTreeIndex()

  private readonly journeyRouters = new Map<string, { router: TRouter; journeyNode: JourneyASTNode }>()

  constructor(
    private readonly forgeDependencies: ForgeDependencies,
    options: ForgeOptions,
  ) {
    this.router = forgeDependencies.frameworkAdapter.createRouter()
    this.basePath = normalizeBasePath(options.basePath)
  }

  mount(
    journeyInstance: JourneyInstance,
    packageDependencies: PackageDependencies,
    forgeDependencies: ForgeDependencies,
  ): number {
    const stepIndex = journeyInstance.getStepIndex()
    const journeyIndex = journeyInstance.getJourneyIndex()
    const artefact = journeyInstance.getSharedCompilationArtefact()
    const routeTreeBuilder = new RouteTreeBuilder(this.routeTreeIndex)
    const { journeyContexts, stepContexts, catalogsByBasePath } = routeTreeBuilder.build({
      basePath: this.basePath,
      stepIndex,
      journeyIndex,
      artefact,
    })

    this.createJourneyRouters(journeyContexts)
    const stepRouteCount = this.mountStepRoutes(stepContexts, journeyInstance, packageDependencies, forgeDependencies)
    const journeyRootRouteCount = this.mountJourneyRootHandlers(
      journeyInstance,
      journeyContexts,
      catalogsByBasePath,
      packageDependencies,
      forgeDependencies,
    )

    return stepRouteCount + journeyRootRouteCount
  }

  getRouter(): TRouter {
    return this.router
  }

  getRouteTree(): StoredRouteTree {
    return this.routeTreeIndex.roots
  }

  private createJourneyRouters(journeyContexts: JourneyRouteContext[]): void {
    journeyContexts.forEach(context => {
      if (this.journeyRouters.has(context.templatePath)) {
        return
      }

      const parentRouter = this.resolveParentRouter(context)
      const newRouter = this.forgeDependencies.frameworkAdapter.createRouter()

      this.forgeDependencies.frameworkAdapter.mountRouter(parentRouter, context.mountPath, newRouter)
      this.journeyRouters.set(context.templatePath, { router: newRouter, journeyNode: context.journeyNode })
    })
  }

  private resolveParentRouter(context: JourneyRouteContext): TRouter {
    if (context.parentTemplatePath === undefined) {
      return this.router
    }

    const parent = this.journeyRouters.get(context.parentTemplatePath)

    if (!parent) {
      throw new Error(`Unable to mount journey route "${context.templatePath}" before its parent router`)
    }

    return parent.router
  }

  private mountStepRoutes(
    stepContexts: StepRouteContext[],
    journeyInstance: JourneyInstance,
    packageDependencies: PackageDependencies,
    forgeDependencies: ForgeDependencies,
  ): number {
    let routeCount = 0

    stepContexts.forEach(ctx => {
      const journeyRouter = this.journeyRouters.get(ctx.journeyBasePath)
      const stepPath = ctx.stepNode.properties.path
      const fullPath = joinPaths(ctx.journeyBasePath, stepPath)

      if (!journeyRouter) {
        throw new Error(`Unable to mount step route "${fullPath}" before its journey router`)
      }

      const resolveCompiledStep = () => journeyInstance.getCompiledStep(ctx.stepId)

      let controller: StepController<unknown, unknown> | undefined

      const getController = () => {
        if (!controller) {
          controller = new StepController(
            resolveCompiledStep(),
            packageDependencies,
            forgeDependencies,
            this.routeTreeIndex.roots,
            ctx.routeTemplatePath,
            ctx.routeTemplateCatalog,
          )
        }

        return controller
      }

      this.forgeDependencies.frameworkAdapter.get(journeyRouter.router, stepPath, (req, res) =>
        getController().get(req, res),
      )
      this.forgeDependencies.frameworkAdapter.post(journeyRouter.router, stepPath, (req, res) =>
        getController().post(req, res),
      )

      routeCount += 2
    })

    return routeCount
  }

  private mountJourneyRootHandlers(
    journeyInstance: JourneyInstance,
    journeyContexts: JourneyRouteContext[],
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    packageDependencies: PackageDependencies,
    forgeDependencies: ForgeDependencies,
  ): number {
    let routeCount = 0

    journeyContexts.forEach(({ journeyNode, templatePath }) => {
      const journeyRouter = this.journeyRouters.get(templatePath)
      const journeyPlan = journeyInstance.getJourneyRuntimePlan(journeyNode.id)
      const routeTemplateCatalog = catalogsByBasePath.get(templatePath)

      if (!journeyRouter || !journeyPlan || !routeTemplateCatalog) {
        return
      }

      let controller: JourneyController<unknown, unknown> | undefined

      const getController = () => {
        if (!controller) {
          journeyInstance.getJourneyCompilationArtefact()
          controller = new JourneyController(journeyPlan, packageDependencies, forgeDependencies, routeTemplateCatalog)
        }

        return controller
      }

      this.forgeDependencies.frameworkAdapter.get(journeyRouter.router, '/', (req, res) =>
        getController().get(req, res),
      )
      routeCount += 1
    })

    return routeCount
  }
}

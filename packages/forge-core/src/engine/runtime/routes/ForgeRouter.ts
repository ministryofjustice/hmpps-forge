import { ForgeDependencies, PackageDependencies } from '../../contracts/ast/engine.type'
import { ForgeOptions } from '../../Forge'
import { joinPaths, normalizeBasePath } from '../../../framework/path/routePath'
import type PackageInstance from '../../PackageInstance'
import {
  createRouteTreeIndex,
  JourneyRouteContext,
  JourneyRouteTemplateCatalog,
  RouteTreeIndex,
  StepRouteContext,
  StoredRouteTree,
} from '../../contracts/routing/routeTree.type'
import RouteTreeBuilder from './RouteTreeBuilder'
import ContextPreparer from '../lifecycle/ContextPreparer'
import RequestOrchestrator from '../orchestrator/RequestOrchestrator'
import type { ForgeResult, PipelineState } from '../orchestrator/types'
import { createAccessLifecyclePhase } from '../orchestrator/phases/accessLifecyclePhase'
import { createAnswerPreparationPhase } from '../orchestrator/phases/answerPreparationPhase'
import { createNavigationPhase } from '../orchestrator/phases/navigationPhase'
import { createEntryValidationPhase } from '../orchestrator/phases/entryValidationPhase'
import { createSubmitPhase } from '../orchestrator/phases/submitPhase'
import { createStepRenderTerminal } from '../orchestrator/terminals/stepRenderTerminal'
import { createJourneyRedirectTerminal } from '../orchestrator/terminals/journeyRedirectTerminal'
import { resolveStepRequestRedirect, resolvePostRequestRedirect } from '../navigation/navigationRedirects'

export default class ForgeRouter<TRouter> {
  private readonly router: TRouter

  private readonly basePath: string

  private readonly routeTreeIndex: RouteTreeIndex = createRouteTreeIndex()

  private readonly journeyRouters = new Map<string, TRouter>()

  private readonly contextPreparer = new ContextPreparer()

  constructor(
    private readonly forgeDependencies: ForgeDependencies,
    options: ForgeOptions,
  ) {
    this.router = forgeDependencies.frameworkAdapter.createRouter()
    this.basePath = normalizeBasePath(options.basePath)
  }

  mount(packageInstance: PackageInstance, forgeDependencies: ForgeDependencies): number {
    const packageDependencies = packageInstance.getDependencies()
    const stepRouteIndex = packageInstance.getStepRouteIndex()
    const journeyRouteIndex = packageInstance.getJourneyRouteIndex()
    const routeTreeBuilder = new RouteTreeBuilder(this.routeTreeIndex)
    const { journeyContexts, stepContexts, catalogsByBasePath } = routeTreeBuilder.build({
      basePath: this.basePath,
      stepRouteIndex,
      journeyRouteIndex,
    })

    this.createJourneyRouters(journeyContexts)
    const stepRouteCount = this.mountStepRoutes(stepContexts, packageInstance, packageDependencies, forgeDependencies)
    const journeyRootRouteCount = this.mountJourneyRootHandlers(
      packageInstance,
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
      this.journeyRouters.set(context.templatePath, newRouter)
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

    return parent
  }

  private mountStepRoutes(
    stepContexts: StepRouteContext[],
    packageInstance: PackageInstance,
    packageDependencies: PackageDependencies,
    forgeDependencies: ForgeDependencies,
  ): number {
    let routeCount = 0

    stepContexts.forEach(ctx => {
      const journeyRouter = this.journeyRouters.get(ctx.journeyBasePath)
      const fullPath = joinPaths(ctx.journeyBasePath, ctx.path)

      if (!journeyRouter) {
        throw new Error(`Unable to mount step route "${fullPath}" before its journey router`)
      }

      const compiledStep = packageInstance.getCompiledStep(ctx.stepId)
      const { functionRegistry } = packageDependencies
      const runtimePlan = compiledStep.runtimePlan
      const journeyCode = packageInstance.getJourneyCode()

      const accessPhase = createAccessLifecyclePhase(
        compiledStep.compiledAccessLifecycle,
        runtimePlan.path,
        functionRegistry,
        forgeDependencies.instrumentation,
      )

      const answersPhase = createAnswerPreparationPhase(
        compiledStep.compiledAnswerPreparation,
        runtimePlan.path,
        functionRegistry,
      )

      const renderTerminal = createStepRenderTerminal(
        compiledStep.compiledRender,
        runtimePlan.path,
        this.routeTreeIndex.roots,
        ctx.routeTemplatePath,
        functionRegistry,
      )

      const getOrchestrator = new RequestOrchestrator(
        [
          accessPhase,
          answersPhase,
          createNavigationPhase(
            compiledStep.navigationPlan.compiledNavigation,
            compiledStep.navigationPlan,
            runtimePlan.stepId,
            ctx.routeTemplateCatalog,
            resolveStepRequestRedirect,
            functionRegistry,
            forgeDependencies.instrumentation,
          ),
          createEntryValidationPhase(
            compiledStep.compiledEntryValidation,
            compiledStep.compiledValidation,
            runtimePlan.stepId,
            runtimePlan.path,
            functionRegistry,
            forgeDependencies.instrumentation,
          ),
        ],
        renderTerminal,
        forgeDependencies.instrumentation,
      )

      const postOrchestrator = new RequestOrchestrator(
        [
          accessPhase,
          answersPhase,
          createNavigationPhase(
            compiledStep.navigationPlan.compiledNavigation,
            compiledStep.navigationPlan,
            runtimePlan.stepId,
            ctx.routeTemplateCatalog,
            resolvePostRequestRedirect,
            functionRegistry,
            forgeDependencies.instrumentation,
          ),
          createSubmitPhase(
            compiledStep.compiledSubmitHooks,
            compiledStep.compiledValidation,
            runtimePlan.stepId,
            runtimePlan.path,
            functionRegistry,
            forgeDependencies.instrumentation,
          ),
        ],
        renderTerminal,
        forgeDependencies.instrumentation,
      )

      this.forgeDependencies.frameworkAdapter.get(journeyRouter, ctx.path, async (req, res) => {
        const result = await this.runRequest(
          getOrchestrator,
          { route: ctx.routeTemplatePath, journeyCode },
          req,
          res,
          runtimePlan,
        )

        this.forgeDependencies.frameworkAdapter.applyResult(result, req, res, packageDependencies.componentRegistry)
      })

      this.forgeDependencies.frameworkAdapter.post(journeyRouter, ctx.path, async (req, res) => {
        const result = await this.runRequest(
          postOrchestrator,
          { route: ctx.routeTemplatePath, journeyCode },
          req,
          res,
          runtimePlan,
        )

        this.forgeDependencies.frameworkAdapter.applyResult(result, req, res, packageDependencies.componentRegistry)
      })

      routeCount += 2
    })

    return routeCount
  }

  private mountJourneyRootHandlers(
    packageInstance: PackageInstance,
    journeyContexts: JourneyRouteContext[],
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    packageDependencies: PackageDependencies,
    forgeDependencies: ForgeDependencies,
  ): number {
    let routeCount = 0

    journeyContexts.forEach(({ journeyId, templatePath }) => {
      const journeyRouter = this.journeyRouters.get(templatePath)
      const compiledJourney = packageInstance.getCompiledJourney(journeyId)
      const routeTemplateCatalog = catalogsByBasePath.get(templatePath)

      if (!journeyRouter || !compiledJourney || !routeTemplateCatalog) {
        return
      }

      const { functionRegistry } = packageDependencies
      const runtimePlan = compiledJourney.runtimePlan
      const journeyCode = packageInstance.getJourneyCode()

      const orchestrator = new RequestOrchestrator(
        [
          createAccessLifecyclePhase(
            compiledJourney.compiledAccessLifecycle,
            runtimePlan.path,
            functionRegistry,
            forgeDependencies.instrumentation,
          ),
          createAnswerPreparationPhase(compiledJourney.compiledAnswerPreparation, runtimePlan.path, functionRegistry),
        ],
        createJourneyRedirectTerminal(
          compiledJourney.navigationPlan.compiledNavigation,
          compiledJourney.navigationPlan,
          routeTemplateCatalog,
          functionRegistry,
        ),
        forgeDependencies.instrumentation,
      )

      this.forgeDependencies.frameworkAdapter.get(journeyRouter, '/', async (req, res) => {
        const result = await this.runRequest(
          orchestrator,
          { route: runtimePlan.path, journeyCode },
          req,
          res,
          runtimePlan,
        )

        this.forgeDependencies.frameworkAdapter.applyResult(result, req, res, packageDependencies.componentRegistry)
      })

      routeCount += 1
    })

    return routeCount
  }

  private prepareRequest(
    req: unknown,
    res: unknown,
    runtimePlan: { staticData: Record<string, unknown> },
  ): PipelineState {
    const request = this.forgeDependencies.frameworkAdapter.toStepRequest(req)
    const response = this.forgeDependencies.frameworkAdapter.toStepResponse(res)
    const context = this.contextPreparer.prepare(runtimePlan, request, response)

    return { context, request }
  }

  private async runRequest(
    orchestrator: RequestOrchestrator,
    attributes: { route: string; journeyCode: string },
    req: unknown,
    res: unknown,
    runtimePlan: { staticData: Record<string, unknown> },
  ): Promise<ForgeResult> {
    this.forgeDependencies.instrumentation.getCurrentSpan()?.setAttributes({
      'http.route': attributes.route,
      'forge.journey.code': attributes.journeyCode,
    })

    const state = this.prepareRequest(req, res, runtimePlan)

    return orchestrator.execute(state)
  }
}

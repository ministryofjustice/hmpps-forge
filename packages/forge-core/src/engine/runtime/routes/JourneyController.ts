import createHttpError from 'http-errors'
import { JourneyInstanceDependencies } from '../../types/engine.type'
import { CompilationArtefact } from '../../compilation/CompilationFactory'
import { JourneyRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluator from '../../compilation/thunks/ThunkEvaluator'
import { StepRequest } from '../../../framework/types/request.type'
import { resolvePathParams } from '../../../framework/path/routePath'
import { resolveRedirectTarget } from '../navigation/redirectTarget'
import ContextPreparer from '../lifecycle/ContextPreparer'
import RuntimeExpansionService from '../expansion/RuntimeExpansionService'
import AnswerPreparer from '../lifecycle/AnswerPreparer'
import NavigationAnalyzer from '../navigation/NavigationAnalyzer'
import HookExecutor from '../lifecycle/HookExecutor'
import StepValidityAnalyzer from '../validation/StepValidityAnalyzer'
import NavigationDecisionResolver from '../navigation/NavigationDecisionResolver'
import { JourneyRouteTemplateCatalog } from './routes.type'

export default class JourneyController<TRequest, TResponse> {
  private readonly contextPreparer: ContextPreparer

  private readonly hookExecutor: HookExecutor

  private readonly runtimeExpansionService: RuntimeExpansionService

  private readonly answerPreparer: AnswerPreparer

  private readonly navigationAnalyzer: NavigationAnalyzer

  private readonly navigationDecisionResolver: NavigationDecisionResolver

  private readonly stepValidityAnalyzer: StepValidityAnalyzer

  constructor(
    private readonly journeyPlan: JourneyRuntimePlan,
    private readonly journeyArtefact: CompilationArtefact,
    private readonly dependencies: JourneyInstanceDependencies,
    private readonly routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ) {
    this.contextPreparer = new ContextPreparer()
    this.hookExecutor = new HookExecutor(this.dependencies.logger)
    this.runtimeExpansionService = new RuntimeExpansionService()
    this.answerPreparer = new AnswerPreparer()
    this.navigationAnalyzer = new NavigationAnalyzer()
    this.navigationDecisionResolver = new NavigationDecisionResolver()
    this.stepValidityAnalyzer = new StepValidityAnalyzer()
  }

  async get(req: TRequest, res: TResponse): Promise<void> {
    const { request, evaluator, context } = this.prepareRequest(req, res)

    const accessResult = await this.hookExecutor.executeAccessLifecycle(this.journeyPlan, evaluator, context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, request, this.getRedirectTarget(accessResult.redirect))
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(accessResult.status), accessResult.message || 'Access denied')
    }

    await this.runtimeExpansionService.expandAllForPlan(this.journeyPlan.reachabilityPlan.entries, context, evaluator)
    await this.answerPreparer.prepare(evaluator, context)

    const evaluation = await this.navigationAnalyzer.evaluate(
      this.journeyPlan.reachabilityPlan,
      undefined,
      this.routeTemplateCatalog,
      evaluator,
      context,
      this.stepValidityAnalyzer,
    )

    const redirectRouteTemplatePath = this.navigationDecisionResolver.resolveJourneyRootRedirect(evaluation)

    if (redirectRouteTemplatePath) {
      return this.redirectToRouteTemplatePath(res, request, redirectRouteTemplatePath)
    }

    throw createHttpError(500, 'No steps found in journey')
  }

  private prepareRequest(req: TRequest, res: TResponse) {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)
    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.journeyArtefact, this.dependencies)
    const context = this.contextPreparer.prepare(this.journeyPlan, evaluator, request, response)

    return { request, evaluator, context }
  }

  private redirect(res: TResponse, request: StepRequest, redirect: string): void {
    const resolvedTarget = resolveRedirectTarget(redirect, request.location)

    return this.dependencies.frameworkAdapter.redirect(res, resolvedTarget.value)
  }

  private redirectToRouteTemplatePath(res: TResponse, request: StepRequest, routeTemplatePath: string): void {
    return this.dependencies.frameworkAdapter.redirect(res, resolvePathParams(routeTemplatePath, request.getParams()))
  }

  private getRedirectTarget(redirect: string | undefined): string {
    if (redirect === undefined) {
      throw createHttpError(500, 'Hook redirect target is missing')
    }

    return redirect
  }

  private getErrorStatus(status: number | undefined): number {
    return status ?? 500
  }
}

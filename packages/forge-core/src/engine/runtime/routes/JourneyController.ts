import createHttpError from 'http-errors'
import { JourneyInstanceDependencies } from '../../types/engine.type'
import { CompilationArtefact } from '../../compilation/CompilationFactory'
import { JourneyRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import { StepRequest } from '../../../framework/types/request.type'
import { resolvePathParams } from '../../../framework/path/routePath'
import { resolveRedirectTarget } from '../navigation/redirectTarget'
import ContextPreparer from '../lifecycle/ContextPreparer'
import NavigationAnalyzer, { resolveJourneyRootRedirect } from '../navigation/NavigationAnalyzer'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { CompiledReachabilityResult } from '../../compilation/reachability/ReachabilityCompiler'
import { CompiledAccessHookResult, HookLifecycleContext } from '../../compilation/hooks/HookLifecycleCompiler'

export default class JourneyController<TRequest, TResponse> {
  private readonly contextPreparer: ContextPreparer

  private readonly navigationAnalyzer: NavigationAnalyzer

  constructor(
    private readonly journeyPlan: JourneyRuntimePlan,
    private readonly journeyArtefact: CompilationArtefact,
    private readonly dependencies: JourneyInstanceDependencies,
    private readonly routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ) {
    this.contextPreparer = new ContextPreparer()
    this.navigationAnalyzer = new NavigationAnalyzer()
  }

  async get(req: TRequest, res: TResponse): Promise<void> {
    const { request, context } = this.prepareRequest(req, res)

    const accessResult = await this.executeAccessLifecycle(context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, request, this.getRedirectTarget(accessResult.redirect))
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(accessResult.status), accessResult.message || 'Access denied')
    }

    await this.prepareAnswers(context)

    const compiledResult = await this.evaluateCompiledReachability(context)

    const evaluation = await this.navigationAnalyzer.evaluate(
      this.journeyPlan.reachabilityPlan,
      undefined,
      this.routeTemplateCatalog,
      context,
      compiledResult,
      this.dependencies.functionRegistry,
    )

    const redirectRouteTemplatePath = resolveJourneyRootRedirect(evaluation)

    if (redirectRouteTemplatePath) {
      return this.redirectToRouteTemplatePath(res, request, redirectRouteTemplatePath)
    }

    throw createHttpError(500, 'No steps found in journey')
  }

  private prepareRequest(req: TRequest, res: TResponse) {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)
    const context = this.contextPreparer.prepare(
      this.journeyPlan,
      this.journeyArtefact,
      this.dependencies,
      request,
      response,
    )

    return { request, context }
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

  private async executeAccessLifecycle(context: RuntimeEvaluationContext): Promise<CompiledAccessHookResult> {
    const compiledFn = this.journeyPlan.compiledAccessLifecycle

    if (!compiledFn) {
      throw new Error(
        `[Forge] Hook fallback is disabled — compiledAccessLifecycle is missing for journey "${this.journeyPlan.path}"`,
      )
    }

    return compiledFn(this.buildHookContext(context))
  }

  private buildHookContext(context: RuntimeEvaluationContext): HookLifecycleContext {
    return {
      answers: context.global.answers,
      data: context.global.data,
      validation: context.global.validation,
      session: (context.request.getSession() ?? {}) as Record<string, unknown>,
      params: context.request.getParams(),
      query: context.request.getAllQuery(),
      post: context.request.getAllPost(),
      request: {
        url: context.request.url,
        path: context.request.location.pathname,
        method: context.request.method,
        headers: context.request.getAllHeaders(),
        cookies: context.request.getAllCookies(),
        state: context.request.getAllState(),
      },
      conditions: this.dependencies.functionRegistry,
      scope: context.scope,
      logger: this.dependencies.logger,
      effectContext: {
        global: context.global,
        request: context.request,
        response: context.response,
      },
    }
  }

  /**
   * Mirrors StepController.prepareAnswers(), but uses the journey-level compiled
   * function. Journey-root requests have no current step, so the function is
   * compiled from the direct steps owned by this journey.
   */
  private async prepareAnswers(context: RuntimeEvaluationContext): Promise<void> {
    const compiledFn = this.journeyPlan.compiledAnswerPreparation

    if (!compiledFn) {
      throw new Error(
        `[Forge] Journey answer preparation compilation is required — compiledAnswerPreparation is missing for journey "${this.journeyPlan.path}"`,
      )
    }

    await compiledFn({
      answers: context.global.answers,
      data: context.global.data,
      session: (context.request.getSession() ?? {}) as Record<string, unknown>,
      params: context.request.getParams(),
      query: context.request.getAllQuery(),
      request: {
        url: context.request.url,
        path: context.request.location.pathname,
        method: context.request.method,
        headers: context.request.getAllHeaders(),
        cookies: context.request.getAllCookies(),
        state: context.request.getAllState(),
      },
      conditions: this.dependencies.functionRegistry,
      scope: context.scope,
      post: context.request.getAllPost(),
    })
  }

  /**
   * Same pattern as StepController.evaluateCompiledReachability — assembles the
   * ReachabilityContext and calls the compiled function. Hybrid compiled
   * functions may be sync or async, so callers always await this helper.
   * The journey controller passes `undefined` as currentStepId to
   * NavigationAnalyzer since it handles the journey root.
   */
  private async evaluateCompiledReachability(context: RuntimeEvaluationContext): Promise<CompiledReachabilityResult> {
    const compiledFn = this.journeyPlan.reachabilityPlan.compiledReachability

    if (!compiledFn) {
      throw new Error('[Forge] Reachability fallback is disabled — compiledReachability function is missing from plan')
    }

    return compiledFn({
      answers: context.global.answers,
      data: context.global.data,
      session: (context.request.getSession() ?? {}) as Record<string, unknown>,
      params: context.request.getParams(),
      query: context.request.getAllQuery(),
      request: {
        url: context.request.url,
        path: context.request.location.pathname,
        method: context.request.method,
        headers: context.request.getAllHeaders(),
        cookies: context.request.getAllCookies(),
        state: context.request.getAllState(),
      },
      conditions: this.dependencies.functionRegistry,
    })
  }
}

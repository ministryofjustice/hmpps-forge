import createHttpError from 'http-errors'
import { JourneyInstanceDependencies } from '../../types/engine.type'
import { CompiledForm } from '../../compilation/CompilationFactory'
import ThunkEvaluator from '../../compilation/thunks/ThunkEvaluator'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { StepRequest } from '../../../framework/types/request.type'
import { JourneyMetadata } from '../../../framework/rendering/types'
import { resolvePathParams } from '../../../framework/path/routePath'
import { resolveRedirectTarget } from '../navigation/redirectTarget'
import ContextPreparer from '../lifecycle/ContextPreparer'
import RuntimeExpansionService from '../expansion/RuntimeExpansionService'
import AnswerPreparer from '../lifecycle/AnswerPreparer'
import NavigationAnalyzer from '../navigation/NavigationAnalyzer'
import StepFieldInventoryAnalyzer from '../validation/StepFieldInventoryAnalyzer'
import HookExecutor from '../lifecycle/HookExecutor'
import StepValidityAnalyzer from '../validation/StepValidityAnalyzer'
import NavigationDecisionResolver from '../navigation/NavigationDecisionResolver'
import ReachabilityStateProjector from '../navigation/ReachabilityStateProjector'
import ValidationStateProjector from '../validation/ValidationStateProjector'
import RenderProjector from '../rendering/RenderProjector'
import RuntimeArtifacts from '../RuntimeArtifacts'
import { JourneyRouteTemplateCatalog } from './routes.type'

/**
 * Handles the full request lifecycle for steps.
 *
 * GET: access lifecycle → evaluate → render
 * POST: access lifecycle → action hooks → validation → submit hooks → render/redirect
 *
 * Access lifecycle runs onAccess hooks for each ancestor (outer → inner).
 * Any hook can halt with a redirect or error.
 */
export default class StepController<TRequest, TResponse> {
  private readonly contextPreparer: ContextPreparer

  private readonly hookExecutor: HookExecutor

  private readonly runtimeExpansionService: RuntimeExpansionService

  private readonly validationExecutor: StepValidityAnalyzer

  private readonly answerPreparer: AnswerPreparer

  private readonly navigationEvaluator: NavigationAnalyzer

  private readonly stepFieldInventoryAnalyzer: StepFieldInventoryAnalyzer

  private readonly navigationDecisionResolver: NavigationDecisionResolver

  private readonly reachabilityStateProjector: ReachabilityStateProjector

  private readonly validationStateProjector: ValidationStateProjector

  private readonly renderProjector: RenderProjector

  private readonly routeTemplateCatalog: JourneyRouteTemplateCatalog

  constructor(
    private readonly compiledForm: CompiledForm[number],
    private readonly dependencies: JourneyInstanceDependencies,
    navigationMetadata: JourneyMetadata[],
    currentRouteTemplatePath: string,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ) {
    this.routeTemplateCatalog = routeTemplateCatalog
    this.contextPreparer = new ContextPreparer()
    this.hookExecutor = new HookExecutor(this.dependencies.logger)
    this.runtimeExpansionService = new RuntimeExpansionService()
    this.validationExecutor = new StepValidityAnalyzer()
    this.answerPreparer = new AnswerPreparer()
    this.navigationEvaluator = new NavigationAnalyzer()
    this.stepFieldInventoryAnalyzer = new StepFieldInventoryAnalyzer()
    this.navigationDecisionResolver = new NavigationDecisionResolver()
    this.reachabilityStateProjector = new ReachabilityStateProjector()
    this.validationStateProjector = new ValidationStateProjector()
    this.renderProjector = new RenderProjector(navigationMetadata, currentRouteTemplatePath)
  }

  async get(req: TRequest, res: TResponse): Promise<void> {
    const { request, evaluator, context, artifacts } = this.prepareRequest(req, res)
    const plan = this.compiledForm.runtimePlan

    const accessResult = await this.hookExecutor.executeAccessLifecycle(plan, evaluator, context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, request, this.getRedirectTarget(accessResult.redirect))
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(accessResult.status), accessResult.message || 'Access denied')
    }

    await this.runtimeExpansionService.expandAllForPlan(this.compiledForm.reachabilityPlan.entries, context, evaluator)
    await this.answerPreparer.prepare(evaluator, context)

    await this.evaluateNavigation(artifacts, evaluator, context)
    const navigationEvaluation = artifacts.requireNavigation()
    const reachabilityRedirect = this.navigationDecisionResolver.resolveStepRequestRedirect(navigationEvaluation)

    if (reachabilityRedirect) {
      return this.redirectToRouteTemplatePath(res, request, reachabilityRedirect)
    }

    const renderContext = await this.renderProjector.build(plan, evaluator, context, artifacts, request)

    return this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  async post(req: TRequest, res: TResponse): Promise<void> {
    const { request, evaluator, context, artifacts } = this.prepareRequest(req, res)
    const plan = this.compiledForm.runtimePlan

    const accessResult = await this.hookExecutor.executeAccessLifecycle(plan, evaluator, context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, request, this.getRedirectTarget(accessResult.redirect))
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(accessResult.status), accessResult.message || 'Access denied')
    }

    await this.runtimeExpansionService.expandAllForPlan(this.compiledForm.reachabilityPlan.entries, context, evaluator)
    await this.answerPreparer.prepare(evaluator, context)

    await this.evaluateNavigation(artifacts, evaluator, context)
    const navigationEvaluation = artifacts.requireNavigation()
    const reachabilityRedirect = this.navigationDecisionResolver.resolvePostRequestRedirect(navigationEvaluation)

    if (reachabilityRedirect) {
      return this.redirectToRouteTemplatePath(res, request, reachabilityRedirect)
    }

    await this.hookExecutor.executeActionHooks(plan, evaluator, context)

    await this.runtimeExpansionService.refreshExpansion(plan.iterateNodeIds, context, evaluator)

    if (plan.hasValidatingSubmitHook) {
      await this.evaluateValidation(artifacts, evaluator, context)
    }

    const submitResult = await this.hookExecutor.executeSubmitHooks(plan, evaluator, context)

    if (submitResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(submitResult.status), submitResult.message || 'Submission error')
    }

    if (submitResult.outcome === 'redirect') {
      return this.redirect(res, request, this.getRedirectTarget(submitResult.redirect))
    }

    const renderOptions = submitResult.validated ? { showValidationFailures: true } : {}

    const renderContext = await this.renderProjector.build(plan, evaluator, context, artifacts, request, renderOptions)

    return this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  private prepareRequest(req: TRequest, res: TResponse) {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)
    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.compiledForm.artefact, this.dependencies)
    const context = this.contextPreparer.prepare(this.compiledForm.runtimePlan, evaluator, request, response)
    const artifacts = new RuntimeArtifacts()

    return { request, evaluator, context, artifacts }
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

  private async evaluateValidation(
    artifacts: RuntimeArtifacts,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    const result = await this.validationExecutor.execute(this.compiledForm.runtimePlan, invoker, context, true)

    artifacts.setStepValidity(result)
    this.validationStateProjector.project(this.compiledForm.runtimePlan.stepId, artifacts, context)
  }

  private async evaluateNavigation(
    artifacts: RuntimeArtifacts,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    artifacts.setStepFieldInventory(
      this.stepFieldInventoryAnalyzer.analyze(this.compiledForm.reachabilityPlan, context),
    )

    artifacts.setNavigation(
      await this.navigationEvaluator.evaluate(
        this.compiledForm.reachabilityPlan,
        this.compiledForm.runtimePlan.stepId,
        this.routeTemplateCatalog,
        invoker,
        context,
        this.validationExecutor,
      ),
    )

    this.reachabilityStateProjector.projectToContext(artifacts, context)
  }
}

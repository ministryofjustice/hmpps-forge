import createHttpError from 'http-errors'
import { JourneyInstanceDependencies } from '../../types/engine.type'
import { CompiledForm } from '../../compilation/CompilationFactory'
import ThunkEvaluator from '../../compilation/thunks/ThunkEvaluator'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { JourneyMetadata } from '../../../framework/rendering/types'
import ContextPreparer from '../preparation/ContextPreparer'
import AnswerPreparer from '../preparation/AnswerPreparer'
import NavigationAnalyzer from '../analysis/NavigationAnalyzer'
import StepFieldInventoryAnalyzer from '../analysis/StepFieldInventoryAnalyzer'
import TransitionExecutor from '../evaluation/TransitionExecutor'
import StepValidityAnalyzer from '../evaluation/StepValidityAnalyzer'
import RedirectResolver from '../resolution/RedirectResolver'
import ReachabilityStateProjector from '../projection/ReachabilityStateProjector'
import ValidationStateProjector from '../projection/ValidationStateProjector'
import RenderProjector from '../projection/RenderProjector'
import RuntimeArtifacts from '../types/RuntimeArtifacts'

/**
 * Handles the full request lifecycle for steps.
 *
 * GET: access lifecycle → evaluate → render
 * POST: access lifecycle → action transitions → validation → submit transitions → render/redirect
 *
 * Access lifecycle runs onAccess transitions for each ancestor (outer → inner).
 * Any transition can halt with a redirect or error.
 */
export default class StepController<TRequest, TResponse> {
  private readonly contextPreparer: ContextPreparer

  private readonly transitionExecutor: TransitionExecutor

  private readonly validationExecutor: StepValidityAnalyzer

  private readonly answerPreparer: AnswerPreparer

  private readonly navigationEvaluator: NavigationAnalyzer

  private readonly stepFieldInventoryAnalyzer: StepFieldInventoryAnalyzer

  private readonly redirectResolver: RedirectResolver

  private readonly reachabilityStateProjector: ReachabilityStateProjector

  private readonly validationStateProjector: ValidationStateProjector

  private readonly renderProjector: RenderProjector<TRequest>

  constructor(
    private readonly compiledForm: CompiledForm[number],
    private readonly dependencies: JourneyInstanceDependencies,
    navigationMetadata: JourneyMetadata[],
    currentStepPath: string,
  ) {
    this.contextPreparer = new ContextPreparer()
    this.transitionExecutor = new TransitionExecutor(this.dependencies.logger)
    this.validationExecutor = new StepValidityAnalyzer()
    this.answerPreparer = new AnswerPreparer()
    this.navigationEvaluator = new NavigationAnalyzer()
    this.stepFieldInventoryAnalyzer = new StepFieldInventoryAnalyzer()
    this.redirectResolver = new RedirectResolver()
    this.reachabilityStateProjector = new ReachabilityStateProjector()
    this.validationStateProjector = new ValidationStateProjector()
    this.renderProjector = new RenderProjector(
      req => this.dependencies.frameworkAdapter.getBaseUrl(req),
      navigationMetadata,
      currentStepPath,
    )
  }

  async get(req: TRequest, res: TResponse): Promise<void> {
    const { evaluator, context, artifacts } = this.prepareRequest(req, res)
    const plan = this.compiledForm.runtimePlan

    const accessResult = await this.transitionExecutor.executeAccessLifecycle(plan, evaluator, context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, req, this.getRedirectTarget(accessResult.redirect))
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(accessResult.status), accessResult.message || 'Access denied')
    }

    if (plan.isAnswerPrepareSync) {
      this.answerPreparer.prepareSync(plan, evaluator, context)
    } else {
      await this.answerPreparer.prepare(plan, evaluator, context)
    }

    await this.evaluateNavigation(artifacts, evaluator, context)
    const navigationEvaluation = artifacts.requireNavigation()
    const reachabilityRedirect = this.redirectResolver.resolve(navigationEvaluation)

    if (reachabilityRedirect) {
      return this.redirect(res, req, reachabilityRedirect)
    }

    const renderContext = plan.isRenderSync
      ? this.renderProjector.buildSync(plan, evaluator, context, artifacts, req)
      : await this.renderProjector.build(plan, evaluator, context, artifacts, req)

    return this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  async post(req: TRequest, res: TResponse): Promise<void> {
    const { evaluator, context, artifacts } = this.prepareRequest(req, res)
    const plan = this.compiledForm.runtimePlan

    const accessResult = await this.transitionExecutor.executeAccessLifecycle(plan, evaluator, context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, req, this.getRedirectTarget(accessResult.redirect))
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(accessResult.status), accessResult.message || 'Access denied')
    }

    if (plan.isAnswerPrepareSync) {
      this.answerPreparer.prepareSync(plan, evaluator, context)
    } else {
      await this.answerPreparer.prepare(plan, evaluator, context)
    }

    await this.evaluateNavigation(artifacts, evaluator, context)
    const navigationEvaluation = artifacts.requireNavigation()
    const reachabilityRedirect = this.redirectResolver.resolve(navigationEvaluation)

    if (reachabilityRedirect) {
      return this.redirect(res, req, reachabilityRedirect)
    }

    await this.transitionExecutor.executeActionTransitions(plan, evaluator, context)

    if (plan.hasValidatingSubmitTransition || plan.hasDomainValidation) {
      if (plan.isValidationSync) {
        this.evaluateValidationSync(artifacts, evaluator, context)
      } else {
        await this.evaluateValidation(artifacts, evaluator, context)
      }
    }

    const submitResult = await this.transitionExecutor.executeSubmitTransitions(plan, evaluator, context)

    if (submitResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(submitResult.status), submitResult.message || 'Submission error')
    }

    if (submitResult.outcome === 'redirect') {
      return this.redirect(res, req, this.getRedirectTarget(submitResult.redirect))
    }

    const renderOptions = submitResult.validated ? { showValidationFailures: true } : {}

    const renderContext = plan.isRenderSync
      ? this.renderProjector.buildSync(plan, evaluator, context, artifacts, req, renderOptions)
      : await this.renderProjector.build(plan, evaluator, context, artifacts, req, renderOptions)

    return this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  private prepareRequest(req: TRequest, res: TResponse) {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)
    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.compiledForm.artefact, this.dependencies)
    const context = this.contextPreparer.prepare(this.compiledForm.runtimePlan, evaluator, request, response)
    const artifacts = new RuntimeArtifacts()

    return { evaluator, context, artifacts }
  }

  private redirect(res: TResponse, req: TRequest, redirect: string): void {
    if (redirect.includes('://') || redirect.startsWith('/')) {
      return this.dependencies.frameworkAdapter.redirect(res, redirect)
    }

    return this.dependencies.frameworkAdapter.redirect(res, this.resolveJourneyRelativePath(req, redirect))
  }

  private resolveJourneyRelativePath(req: TRequest, relativePath: string): string {
    const baseUrl = this.dependencies.frameworkAdapter.getBaseUrl(req)

    return `${baseUrl}/${relativePath}`
  }

  private getRedirectTarget(redirect: string | undefined): string {
    if (redirect === undefined) {
      throw createHttpError(500, 'Transition redirect target is missing')
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
    const result = await this.validationExecutor.execute(this.compiledForm.runtimePlan, invoker, context)

    artifacts.setStepValidity(result)
    this.validationStateProjector.project(this.compiledForm.runtimePlan.stepId, artifacts, context)
  }

  private evaluateValidationSync(
    artifacts: RuntimeArtifacts,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): void {
    const result = this.validationExecutor.executeSync(this.compiledForm.runtimePlan, invoker, context)

    artifacts.setStepValidity(result)
    this.validationStateProjector.project(this.compiledForm.runtimePlan.stepId, artifacts, context)
  }

  private async evaluateNavigation(
    artifacts: RuntimeArtifacts,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    artifacts.setStepFieldInventory(
      await this.stepFieldInventoryAnalyzer.analyze(this.compiledForm.reachabilityPlan, invoker, context),
    )

    artifacts.setNavigation(
      await this.navigationEvaluator.evaluate(
        this.compiledForm.reachabilityPlan,
        this.compiledForm.runtimePlan.stepId,
        invoker,
        context,
        this.validationExecutor,
      ),
    )

    this.reachabilityStateProjector.projectToContext(artifacts, context)
  }
}

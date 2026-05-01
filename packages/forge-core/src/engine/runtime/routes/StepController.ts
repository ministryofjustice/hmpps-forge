import createHttpError from 'http-errors'
import { JourneyInstanceDependencies } from '../../types/engine.type'
import { CompiledForm } from '../../compilation/CompilationFactory'
import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import {
  buildCompiledAnswerPreparationContext,
  buildCompiledBaseContext,
  buildCompiledHookLifecycleContext,
  buildCompiledRenderContext,
} from '../context/compiledEvaluationContext'
import { StepRequest } from '../../../framework/types/request.type'
import { JourneyMetadata, RenderContext } from '../../../framework/rendering/types'
import { resolvePathParams } from '../../../framework/path/routePath'
import { resolveRedirectTarget } from '../navigation/redirectTarget'
import ContextPreparer from '../lifecycle/ContextPreparer'
import NavigationAnalyzer, {
  resolvePostRequestRedirect,
  resolveStepRequestRedirect,
} from '../navigation/NavigationAnalyzer'
import { NavigationEvaluation } from '../types/NavigationEvaluation.type'
import { resolveBacklinkRouteTemplatePath } from '../navigation/NavigationPathAnalyzer'
import ReachabilityStateProjector from '../reachability/ReachabilityStateProjector'
import RenderContextFactory from '../rendering/RenderContextFactory'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
import { CompiledReachabilityResult } from '../../compilation/codegen/phase-compilers/reachability/ReachabilityCompiler'
import { CompiledRenderResult } from '../../compilation/codegen/phase-compilers/rendering/StepRenderCompiler'
import { StepFieldInventory } from '../types/StepFieldInventory.type'
import { StepValidityResult } from '../types/StepValidityResult.type'
import {
  CompiledAccessHookResult,
  CompiledSubmitHookResult,
} from '../../compilation/codegen/phase-compilers/hooks/HookLifecycleCompiler'

/**
 * Handles the full request lifecycle for steps.
 *
 * GET: access lifecycle → evaluate → render
 * POST: access lifecycle → submit hooks → render/redirect
 *
 * Access lifecycle runs onAccess hooks for each ancestor (outer → inner).
 * Any hook can halt with a redirect or error.
 */
export default class StepController<TRequest, TResponse> {
  private readonly contextPreparer: ContextPreparer

  private readonly navigationEvaluator: NavigationAnalyzer

  private readonly reachabilityStateProjector: ReachabilityStateProjector

  private readonly routeTemplateCatalog: JourneyRouteTemplateCatalog

  private readonly navigationMetadata: JourneyMetadata[]

  private readonly currentRouteTemplatePath: string

  constructor(
    private readonly compiledForm: CompiledForm[number],
    private readonly dependencies: JourneyInstanceDependencies,
    navigationMetadata: JourneyMetadata[],
    currentRouteTemplatePath: string,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ) {
    this.routeTemplateCatalog = routeTemplateCatalog
    this.navigationMetadata = navigationMetadata
    this.currentRouteTemplatePath = currentRouteTemplatePath
    this.contextPreparer = new ContextPreparer()
    this.navigationEvaluator = new NavigationAnalyzer()
    this.reachabilityStateProjector = new ReachabilityStateProjector()
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

    const navigationEvaluation = await this.evaluateNavigation(context)
    const reachabilityRedirect = resolveStepRequestRedirect(navigationEvaluation)

    if (reachabilityRedirect) {
      return this.redirectToRouteTemplatePath(res, request, reachabilityRedirect)
    }

    const entryValidationGroups = await this.evaluateEntryValidationGroups(context)
    const validation =
      entryValidationGroups.length > 0
        ? await this.evaluateValidation(context, false, entryValidationGroups)
        : undefined
    const renderContext = await this.buildRenderContext(context, navigationEvaluation, request, validation, {
      showValidationFailures: validation !== undefined,
    })

    return this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  async post(req: TRequest, res: TResponse): Promise<void> {
    const { request, context } = this.prepareRequest(req, res)

    const accessResult = await this.executeAccessLifecycle(context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, request, this.getRedirectTarget(accessResult.redirect))
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(accessResult.status), accessResult.message || 'Access denied')
    }

    await this.prepareAnswers(context)

    const navigationEvaluation = await this.evaluateNavigation(context)
    const reachabilityRedirect = resolvePostRequestRedirect(navigationEvaluation)

    if (reachabilityRedirect) {
      return this.redirectToRouteTemplatePath(res, request, reachabilityRedirect)
    }

    const submitResult = await this.executeSubmitHooks(context)

    if (submitResult.outcome === 'error') {
      throw createHttpError(this.getErrorStatus(submitResult.status), submitResult.message || 'Submission error')
    }

    if (submitResult.outcome === 'redirect') {
      return this.redirect(res, request, this.getRedirectTarget(submitResult.redirect))
    }

    const renderContext = await this.buildRenderContext(
      context,
      navigationEvaluation,
      request,
      context.global.validation,
      {
        showValidationFailures: submitResult.validated,
      },
    )

    return this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  private prepareRequest(req: TRequest, res: TResponse) {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)
    const context = this.contextPreparer.prepare(
      this.compiledForm.runtimePlan,
      this.compiledForm.artefact,
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
    const compiledFn = this.compiledForm.runtimePlan.compiledAccessLifecycle

    if (!compiledFn) {
      throw new Error(
        `[Forge] Hook fallback is disabled — compiledAccessLifecycle is missing for step "${this.compiledForm.runtimePlan.path}"`,
      )
    }

    return compiledFn(buildCompiledHookLifecycleContext(context, this.dependencies))
  }

  private async executeSubmitHooks(context: RuntimeEvaluationContext): Promise<CompiledSubmitHookResult> {
    const compiledFn = this.compiledForm.runtimePlan.compiledSubmitHooks

    if (!compiledFn) {
      throw new Error(
        `[Forge] Hook fallback is disabled — compiledSubmitHooks is missing for step "${this.compiledForm.runtimePlan.path}"`,
      )
    }

    return compiledFn(
      buildCompiledHookLifecycleContext(context, this.dependencies, groups =>
        this.evaluateValidation(context, true, groups),
      ),
    )
  }

  private async evaluateEntryValidationGroups(context: RuntimeEvaluationContext): Promise<string[]> {
    const compiledEntryValidation = this.compiledForm.compiledEntryValidation

    if (!compiledEntryValidation) {
      return []
    }

    return compiledEntryValidation(buildCompiledBaseContext(context, this.dependencies.functionRegistry))
  }

  private async evaluateValidation(
    context: RuntimeEvaluationContext,
    isSubmission: boolean,
    groups: string[],
  ): Promise<StepValidityResult> {
    const compiledValidation = this.compiledForm.compiledValidation

    if (!compiledValidation) {
      throw new Error(
        `[Forge] Validation fallback is disabled — compiledValidation is missing for step "${this.compiledForm.runtimePlan.path}"`,
      )
    }

    const result = await compiledValidation(
      buildCompiledBaseContext(context, this.dependencies.functionRegistry),
      isSubmission,
      groups,
    )

    context.global.validation = {
      stepId: this.compiledForm.runtimePlan.stepId,
      validated: true,
      groups,
      isSubmission,
      isValid: result.isValid,
      fieldFailures: result.fieldFailures,
      domainFailures: result.domainFailures,
    }

    return result
  }

  /**
   * Calls the compiled answer preparation function, which resolves all field
   * answers — POST extraction, formatters, dependentWhen, and default values.
   * Sync-only compilations return immediately; async user functions return a
   * Promise. Mutates context.global.answers in place.
   */
  private async prepareAnswers(context: RuntimeEvaluationContext): Promise<void> {
    const compiledFn = this.compiledForm.compiledAnswerPreparation

    if (!compiledFn) {
      throw new Error(
        `[Forge] Answer preparation compilation is required — compiledAnswerPreparation is missing for step "${this.compiledForm.runtimePlan.path}"`,
      )
    }

    await compiledFn(buildCompiledAnswerPreparationContext(context, this.dependencies.functionRegistry))
  }

  /**
   * Builds the final RenderContext by calling the compiled render function,
   * enriching step metadata with backlink resolution, and assembling via
   * RenderContextFactory. Render has no interpreted fallback, so missing compiled
   * functions fail fast before this method runs.
   */
  private async buildRenderContext(
    context: RuntimeEvaluationContext,
    navigationEvaluation: NavigationEvaluation,
    request: StepRequest,
    validation?: StepValidityResult,
    options?: { showValidationFailures?: boolean },
  ): Promise<RenderContext> {
    const renderResult = await this.evaluateCompiledRender(context)
    const step = this.resolveStepMetadata(renderResult.step as RenderContext['step'], request, navigationEvaluation)

    return RenderContextFactory.build(
      {
        step,
        ancestors: renderResult.ancestors as RenderContext['ancestors'],
        blocks: renderResult.blocks as unknown as RenderContext['blocks'],
        answers: context.global.answers,
        data: context.global.data,
        fieldValidationFailures: validation?.fieldFailures ?? [],
        domainValidationFailures: validation?.domainFailures ?? [],
      },
      {
        navigationMetadata: this.navigationMetadata,
        currentStepPath: this.currentRouteTemplatePath,
        showValidationFailures: options?.showValidationFailures,
        params: request.getParams(),
      },
    )
  }

  /**
   * Calls the compiled render function with the shared compiled-function
   * context snapshot.
   */
  private async evaluateCompiledRender(context: RuntimeEvaluationContext): Promise<CompiledRenderResult> {
    const compiledFn = this.compiledForm.compiledRender

    if (!compiledFn) {
      throw new Error(
        `[Forge] Render compilation is required — compiledRender function is missing for step "${this.compiledForm.runtimePlan.path}"`,
      )
    }

    return compiledFn(buildCompiledRenderContext(context, this.dependencies.functionRegistry))
  }

  private resolveStepMetadata(
    step: RenderContext['step'],
    request: StepRequest,
    navigationEvaluation: NavigationEvaluation,
  ): RenderContext['step'] {
    if (step.backlink !== undefined) {
      return step
    }

    const backPath = resolveBacklinkRouteTemplatePath(navigationEvaluation)

    if (!backPath) {
      return step
    }

    return {
      ...step,
      backlink: resolvePathParams(backPath, request.getParams()),
    }
  }

  private async evaluateNavigation(context: RuntimeEvaluationContext): Promise<NavigationEvaluation> {
    const fieldInventory = await this.evaluateCompiledFieldInventory(context)
    const compiledResult = await this.evaluateCompiledReachability(context)
    const navigationEvaluation = await this.navigationEvaluator.evaluate(
      this.compiledForm.reachabilityPlan,
      this.compiledForm.runtimePlan.stepId,
      this.routeTemplateCatalog,
      context,
      compiledResult,
      this.dependencies.functionRegistry,
    )

    this.reachabilityStateProjector.projectToContext(navigationEvaluation, fieldInventory, context)

    return navigationEvaluation
  }

  private async evaluateCompiledFieldInventory(context: RuntimeEvaluationContext): Promise<StepFieldInventory[]> {
    const compiledFn = this.compiledForm.reachabilityPlan.compiledFieldInventory

    if (!compiledFn) {
      throw new Error('[Forge] Field inventory compilation is required — compiledFieldInventory is missing from plan')
    }

    return compiledFn(buildCompiledBaseContext(context, this.dependencies.functionRegistry))
  }

  /**
   * Calls the compiled reachability function if available. Hybrid compiled
   * functions may be sync or async, so callers always await this helper.
   */
  private async evaluateCompiledReachability(context: RuntimeEvaluationContext): Promise<CompiledReachabilityResult> {
    const compiledFn = this.compiledForm.reachabilityPlan.compiledReachability

    if (!compiledFn) {
      throw new Error('[Forge] Reachability fallback is disabled — compiledReachability function is missing from plan')
    }

    return compiledFn(buildCompiledBaseContext(context, this.dependencies.functionRegistry))
  }
}

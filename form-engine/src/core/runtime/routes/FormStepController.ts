import createHttpError from 'http-errors'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { CompiledForm } from '@form-engine/core/compilation/FormCompilationFactory'
import ThunkEvaluator from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { Evaluated, JourneyMetadata } from '@form-engine/core/runtime/rendering/types'
import RenderContextFactory from '@form-engine/core/runtime/rendering/RenderContextFactory'
import TransitionExecutor from '@form-engine/core/runtime/executors/TransitionExecutor'
import ContextPreparer from '@form-engine/core/runtime/executors/ContextPreparer'
import ValidationExecutor from '@form-engine/core/runtime/executors/ValidationExecutor'
import AnswerPreparer from '@form-engine/core/runtime/executors/AnswerPreparer'
import MetadataExecutor, { MetadataExecutionResult } from '@form-engine/core/runtime/executors/MetadataExecutor'
import RenderExecutor from '@form-engine/core/runtime/executors/RenderExecutor'
import { StepController } from './types'

/**
 * Handles the full request lifecycle for form steps.
 *
 * GET: access lifecycle → evaluate → render
 * POST: access lifecycle → action transitions → validation → submit transitions → render/redirect
 *
 * Access lifecycle runs onAccess transitions for each ancestor (outer → inner).
 * Any transition can halt with a redirect or error.
 */
export default class FormStepController<TRequest, TResponse> implements StepController<TRequest, TResponse> {
  private readonly contextPreparer: ContextPreparer

  private readonly transitionExecutor: TransitionExecutor

  private readonly validationExecutor: ValidationExecutor

  private readonly answerPreparer: AnswerPreparer

  private readonly metadataExecutor: MetadataExecutor

  private readonly renderExecutor: RenderExecutor

  constructor(
    private readonly compiledForm: CompiledForm[number],
    private readonly dependencies: FormInstanceDependencies,
    private readonly navigationMetadata: JourneyMetadata[],
    private readonly currentStepPath: string,
  ) {
    this.contextPreparer = new ContextPreparer()
    this.transitionExecutor = new TransitionExecutor(this.dependencies.logger)
    this.validationExecutor = new ValidationExecutor()
    this.answerPreparer = new AnswerPreparer()
    this.metadataExecutor = new MetadataExecutor()
    this.renderExecutor = new RenderExecutor()
  }

  async get(req: TRequest, res: TResponse): Promise<void> {
    const { evaluator, context } = this.prepareRequest(req, res)
    const plan = this.compiledForm.runtimePlan

    const accessResult = await this.transitionExecutor.executeAccessLifecycle(plan, evaluator, context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, req, accessResult.redirect)
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(accessResult.status, accessResult.message || 'Access denied')
    }

    // TODO: Add 'reachability' check

    if (plan.isAnswerPrepareSync) {
      this.answerPreparer.prepareSync(plan, evaluator, context)
    } else {
      await this.answerPreparer.prepare(plan, evaluator, context)
    }

    if (plan.isRenderSync) {
      return this.renderSync(res, req, evaluator, context)
    }

    return await this.render(res, req, evaluator, context)
  }

  async post(req: TRequest, res: TResponse): Promise<void> {
    const { evaluator, context } = this.prepareRequest(req, res)
    const plan = this.compiledForm.runtimePlan

    const accessResult = await this.transitionExecutor.executeAccessLifecycle(plan, evaluator, context)

    if (accessResult.outcome === 'redirect') {
      return this.redirect(res, req, accessResult.redirect)
    }

    if (accessResult.outcome === 'error') {
      throw createHttpError(accessResult.status, accessResult.message || 'Access denied')
    }

    // TODO: Add 'reachability' check

    if (plan.isAnswerPrepareSync) {
      this.answerPreparer.prepareSync(plan, evaluator, context)
    } else {
      await this.answerPreparer.prepare(plan, evaluator, context)
    }

    await this.transitionExecutor.executeActionTransitions(plan, evaluator, context)

    if (plan.hasValidatingSubmitTransition) {
      if (plan.isValidationSync) {
        this.evaluateValidationSync(evaluator, context)
      } else {
        await this.evaluateValidation(evaluator, context)
      }
    }

    const submitResult = await this.transitionExecutor.executeSubmitTransitions(plan, evaluator, context)

    if (submitResult.outcome === 'error') {
      throw createHttpError(submitResult.status!, submitResult.message || 'Submission error')
    }

    if (submitResult.outcome === 'redirect') {
      return this.redirect(res, req, submitResult.redirect)
    }

    const renderOptions = submitResult.validated ? { showValidationFailures: true } : {}

    if (plan.isRenderSync) {
      return this.renderSync(res, req, evaluator, context, renderOptions)
    }

    return await this.render(res, req, evaluator, context, renderOptions)
  }

  private prepareRequest(req: TRequest, res: TResponse) {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)
    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.compiledForm.artefact, this.dependencies)
    const context = this.contextPreparer.prepare(this.compiledForm.runtimePlan, evaluator, request, response)

    return { evaluator, context }
  }

  private redirect(res: TResponse, req: TRequest, redirect: string): void {
    if (redirect.includes('://') || redirect.startsWith('/')) {
      return this.dependencies.frameworkAdapter.redirect(res, redirect)
    }

    const baseUrl = this.dependencies.frameworkAdapter.getBaseUrl(req)

    return this.dependencies.frameworkAdapter.redirect(res, `${baseUrl}/${redirect}`)
  }

  private async render(
    res: TResponse,
    req: TRequest,
    evaluator: ThunkEvaluator,
    context: ThunkEvaluationContext,
    options: { showValidationFailures?: boolean } = {},
  ): Promise<void> {
    const plan = this.compiledForm.runtimePlan

    const [metadata, blocks] = await Promise.all([
      this.metadataExecutor.execute(plan, evaluator, context),
      this.renderExecutor.execute(plan, evaluator, context),
    ])

    this.buildAndRender(res, req, metadata, blocks, context, options)
  }

  private renderSync(
    res: TResponse,
    req: TRequest,
    evaluator: ThunkEvaluator,
    context: ThunkEvaluationContext,
    options: { showValidationFailures?: boolean } = {},
  ): void {
    const plan = this.compiledForm.runtimePlan
    const metadata = this.metadataExecutor.executeSync(plan, evaluator, context)
    const blocks = this.renderExecutor.executeSync(plan, evaluator, context)

    this.buildAndRender(res, req, metadata, blocks, context, options)
  }

  private buildAndRender(
    res: TResponse,
    req: TRequest,
    metadata: MetadataExecutionResult,
    blocks: Evaluated<BlockASTNode>[],
    context: ThunkEvaluationContext,
    options: { showValidationFailures?: boolean } = {},
  ): void {
    const { astNodeTree } = context

    const renderContext = RenderContextFactory.build(
      {
        step: metadata.step,
        ancestors: metadata.ancestors,
        blocks,
        answers: context.global.answers,
        data: context.global.data,
        validationFailures: this.getStepValidationFailures(context),
        hasNestedBlocks: blockId => {
          if (astNodeTree.getNodeType(blockId) === undefined) {
            return true
          }

          return astNodeTree.hasDescendantOfType(blockId, ASTNodeType.BLOCK)
        },
      },
      {
        navigationMetadata: this.navigationMetadata,
        currentStepPath: this.currentStepPath,
        showValidationFailures: options.showValidationFailures,
      },
    )

    this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  private getStepValidationFailures(context: ThunkEvaluationContext) {
    const validation = context.global.validation

    if (validation?.stepId === this.compiledForm.runtimePlan.stepId) {
      return validation.failures
    }

    return []
  }

  private async evaluateValidation(invoker: ThunkInvocationAdapter, context: ThunkEvaluationContext): Promise<void> {
    const validation = await this.validationExecutor.execute(this.compiledForm.runtimePlan, invoker, context)

    context.global.validation = {
      stepId: this.compiledForm.runtimePlan.stepId,
      validated: true,
      isValid: validation.isValid,
      failures: validation.failures,
    }
  }

  private evaluateValidationSync(invoker: ThunkInvocationAdapter, context: ThunkEvaluationContext): void {
    const validation = this.validationExecutor.executeSync(this.compiledForm.runtimePlan, invoker, context)

    context.global.validation = {
      stepId: this.compiledForm.runtimePlan.stepId,
      validated: true,
      isValid: validation.isValid,
      failures: validation.failures,
    }
  }
}

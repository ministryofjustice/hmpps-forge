import createHttpError, { Forbidden } from 'http-errors'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { CompiledForm } from '@form-engine/core/ast/compilation/FormCompilationFactory'
import ThunkEvaluator, { EvaluationResult } from '@form-engine/core/ast/thunks/ThunkEvaluator'
import { EvaluatorRequestData, ThunkInvocationAdapter } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { commitPendingEffects } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { LoadTransitionResult } from '@form-engine/core/ast/thunks/handlers/transitions/LoadTransitionHandler'
import { AccessTransitionResult } from '@form-engine/core/ast/thunks/handlers/transitions/AccessTransitionHandler'
import { SubmitTransitionResult } from '@form-engine/core/ast/thunks/handlers/transitions/SubmitTransitionHandler'
import { ActionTransitionResult } from '@form-engine/core/ast/thunks/handlers/transitions/ActionTransitionHandler'
import {
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  LoadTransitionASTNode,
  SubmitTransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import getAncestorChain from '@form-engine/core/ast/utils/getAncestorChain'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import RenderContextFactory from '@form-engine/core/runtime/rendering/RenderContextFactory'
import { JourneyMetadata } from '@form-engine/core/runtime/rendering/types'
import { StepController, StepRequest } from './types'

/**
 * FormStepController - Handles the full request lifecycle for form steps
 *
 * Manages GET (access) and POST (submission) requests, including:
 * - Lifecycle transitions (onLoad, onAccess, onAction, onSubmission)
 * - AST evaluation
 * - Response rendering or redirecting
 *
 * ## GET Request Flow
 * For each ancestor (outer journey → inner journey → step):
 * 1. Run onLoad transitions
 * 2. Run onAccess transitions (guard checks)
 * 3. If guard fails → redirect or 403
 * After all ancestors pass:
 * 4. Evaluate AST
 * 5. Render response
 *
 * ## POST Request Flow
 * 1. Run full access lifecycle (same as GET)
 * 2. Run step's onAction transitions (in-page actions like postcode lookup)
 * 3. Run step's onSubmission transitions (validation, navigation)
 * 4. If submission has redirect → redirect
 * 5. Otherwise → evaluate AST and render (with validation errors if applicable)
 */
export default class FormStepController<TRequest, TResponse> implements StepController<TRequest, TResponse> {
  constructor(
    private readonly compiledForm: CompiledForm[number],
    private readonly dependencies: FormInstanceDependencies,
    private readonly navigationMetadata: JourneyMetadata[],
    private readonly currentStepPath: string,
  ) {}

  /** Handle GET request: run access lifecycle, evaluate AST, render response. */
  async get(request: StepRequest, req: TRequest, res: TResponse): Promise<void> {
    this.dependencies.logger.debug(`GET request to step at path ${request.path}`)

    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.compiledForm.artefact, this.dependencies)
    const context = evaluator.createContext(this.buildRequestData(request))
    const ancestors = this.findLifecycleAncestors(context)

    for (const ancestor of ancestors) {
      this.mergeStaticData(ancestor, context)

      // eslint-disable-next-line no-await-in-loop
      await this.runLoadTransitions(evaluator, ancestor, context)

      // eslint-disable-next-line no-await-in-loop
      const accessResult = await this.runAccessTransitions(evaluator, ancestor, context)

      if (!accessResult.passed) {
        if (accessResult.redirect) {
          return this.redirect(res, req, accessResult.redirect)
        }

        if (accessResult.status !== undefined) {
          throw createHttpError(accessResult.status, accessResult.message || 'Access denied')
        }

        throw new Forbidden(`Access denied to step`)
      }
    }

    // TODO: Add 'reachability' check

    await this.evaluateAnswerPseudoNodes(evaluator, context)

    const evaluationResult = await evaluator.evaluate(context)

    return this.render(res, req, evaluationResult)
  }

  /** Handle POST request: run access lifecycle, action/submit transitions, render or redirect. */
  async post(request: StepRequest, req: TRequest, res: TResponse): Promise<void> {
    this.dependencies.logger.debug(`POST request to step at path ${request.path}`)

    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.compiledForm.artefact, this.dependencies)
    const context = evaluator.createContext(this.buildRequestData(request))
    const ancestors = this.findLifecycleAncestors(context)

    for (const ancestor of ancestors) {
      this.mergeStaticData(ancestor, context)

      // eslint-disable-next-line no-await-in-loop
      await this.runLoadTransitions(evaluator, ancestor, context)

      // eslint-disable-next-line no-await-in-loop
      const accessResult = await this.runAccessTransitions(evaluator, ancestor, context)

      if (!accessResult.passed) {
        if (accessResult.redirect) {
          return this.redirect(res, req, accessResult.redirect)
        }

        if (accessResult.status !== undefined) {
          throw createHttpError(accessResult.status, accessResult.message || 'Access denied')
        }

        throw new Forbidden(`Access denied to step`)
      }
    }

    // TODO: Add 'reachability' check

    await this.evaluateAnswerPseudoNodes(evaluator, context)

    const currentStep = this.getCurrentStep(context)

    await this.runActionTransitions(evaluator, currentStep, context)

    const submitResult = await this.runSubmitTransitions(evaluator, currentStep, context)

    if (submitResult.next) {
      return this.redirect(res, req, submitResult.next)
    }

    if (submitResult.validated) {
      const evaluationResult = await evaluator.evaluate(context)

      return this.render(res, req, evaluationResult, { showValidationFailures: true })
    }

    const evaluationResult = await evaluator.evaluate(context)

    return this.render(res, req, evaluationResult)
  }

  /** Redirect to a URL, resolving relative paths against the current base URL. */
  private redirect(res: TResponse, req: TRequest, redirect: string): void {
    if (redirect.includes('://') || redirect.startsWith('/')) {
      return this.dependencies.frameworkAdapter.redirect(res, redirect)
    }

    const baseUrl = this.dependencies.frameworkAdapter.getBaseUrl(req)

    return this.dependencies.frameworkAdapter.redirect(res, `${baseUrl}/${redirect}`)
  }

  /** Build render context from evaluation result and render the response. */
  private async render(
    res: TResponse,
    req: TRequest,
    evaluationResult: EvaluationResult,
    options: { showValidationFailures?: boolean } = {},
  ): Promise<void> {
    const renderContext = RenderContextFactory.build(evaluationResult, this.compiledForm.currentStepId, {
      navigationMetadata: this.navigationMetadata,
      currentStepPath: this.currentStepPath,
      showValidationFailures: options.showValidationFailures,
    })

    return this.dependencies.frameworkAdapter.render(renderContext, req, res)
  }

  /**
   * Merge static data from an ancestor into context.global.data
   *
   * Called before runLoadTransitions() so that:
   * 1. Static data is available to effects via context.getData()
   * 2. Effects can override static data if needed
   * 3. Later ancestors (steps) override earlier ones (journeys) with shallow merge
   */
  private mergeStaticData(ancestor: JourneyASTNode | StepASTNode, context: ThunkEvaluationContext): void {
    const staticData = ancestor.properties.data

    if (staticData !== undefined) {
      Object.assign(context.global.data, staticData)
    }
  }

  /**
   * Run onLoad transitions for an ancestor, committing effects after each
   */
  private async runLoadTransitions(
    invoker: ThunkInvocationAdapter,
    ancestor: JourneyASTNode | StepASTNode,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    const transitions: LoadTransitionASTNode[] = ancestor.properties.onLoad ?? []

    for (const transition of transitions) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke<LoadTransitionResult>(transition.id, context)

      if (!result.error && result.value) {
        // eslint-disable-next-line no-await-in-loop
        await commitPendingEffects(result.value.effects, context, 'load')
      }
    }
  }

  /**
   * Run onAccess transitions with first-match semantics (first failure)
   */
  private async runAccessTransitions(
    invoker: ThunkInvocationAdapter,
    ancestor: JourneyASTNode | StepASTNode,
    context: ThunkEvaluationContext,
  ): Promise<AccessTransitionResult> {
    const transitions: AccessTransitionASTNode[] = ancestor.properties.onAccess ?? []

    for (const transition of transitions) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke<AccessTransitionResult>(transition.id, context)

      // AccessTransitionResult.passed: false if when predicate matched (first-match semantics)
      if (!result.error && result.value?.passed === false) {
        // eslint-disable-next-line no-await-in-loop
        await commitPendingEffects(result.value.pendingEffects ?? [], context, 'access')

        return result.value
      }
    }

    return { passed: true }
  }

  /**
   * Run onAction transitions with first-match semantics
   */
  private async runActionTransitions(
    invoker: ThunkInvocationAdapter,
    step: StepASTNode,
    context: ThunkEvaluationContext,
  ): Promise<ActionTransitionResult> {
    const transitions: ActionTransitionASTNode[] = step.properties.onAction ?? []

    for (const transition of transitions) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke<ActionTransitionResult>(transition.id, context)

      // ActionTransitionResult.executed: true if when predicate matched (first-match semantics)
      if (!result.error && result.value?.executed) {
        // eslint-disable-next-line no-await-in-loop
        await commitPendingEffects(result.value.pendingEffects ?? [], context, 'action')

        return result.value
      }
    }

    return { executed: false }
  }

  /**
   * Run onSubmission transitions with first-match semantics
   */
  private async runSubmitTransitions(
    invoker: ThunkInvocationAdapter,
    step: StepASTNode,
    context: ThunkEvaluationContext,
  ): Promise<SubmitTransitionResult> {
    const transitions: SubmitTransitionASTNode[] = step.properties.onSubmission ?? []

    for (const transition of transitions) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke<SubmitTransitionResult>(transition.id, context)

      if (!result.error && result.value?.executed) {
        // eslint-disable-next-line no-await-in-loop
        await commitPendingEffects(result.value.pendingEffects ?? [], context, 'submit')

        return result.value
      }
    }

    return { executed: false, validated: false }
  }

  /**
   * Evaluate all answer pseudo nodes before action/submit transitions.
   *
   * This ensures that effects in onAction and onSubmission can access
   * resolved answers, not just raw POST data. Each answer pseudo
   * node is invoked to trigger the full resolution pipeline:
   * POST → sanitize → format → dependent check.
   *
   * Both ANSWER_LOCAL (fields on this step) and ANSWER_REMOTE (fields
   * from other steps) are evaluated.
   *
   * If an action later modifies an answer via setAnswer(), the cache
   * is automatically invalidated, ensuring subsequent access sees
   * the action-modified value.
   */
  private async evaluateAnswerPseudoNodes(
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    const localAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_LOCAL)
    const remoteAnswerNodes = context.nodeRegistry.findByType(PseudoNodeType.ANSWER_REMOTE)

    for (const node of [...localAnswerNodes, ...remoteAnswerNodes]) {
      // eslint-disable-next-line no-await-in-loop
      await invoker.invoke(node.id, context)
    }
  }

  /** Find the ancestor chain from outermost journey to current step. */
  private findLifecycleAncestors(context: ThunkEvaluationContext): (StepASTNode | JourneyASTNode)[] {
    return getAncestorChain(this.compiledForm.currentStepId, context.metadataRegistry)
      .map(nodeId => context.nodeRegistry.get(nodeId))
      .filter(node => isStepStructNode(node) || isJourneyStructNode(node))
  }

  /** Get the current step node from the context. */
  private getCurrentStep(context: ThunkEvaluationContext): StepASTNode {
    return context.nodeRegistry.get(this.compiledForm.currentStepId) as StepASTNode
  }

  /** Convert framework-agnostic StepRequest to EvaluatorRequestData. */
  private buildRequestData(request: StepRequest): EvaluatorRequestData {
    return {
      method: request.method,
      post: request.post as Record<string, string | string[]>,
      query: request.query as Record<string, string | string[]>,
      params: request.params,
      session: request.session,
      state: request.state,
    }
  }
}

import createHttpError from 'http-errors'
import { FormInstanceDependencies, NodeId } from '@form-engine/core/types/engine.type'
import { CompiledForm } from '@form-engine/core/compilation/FormCompilationFactory'
import ThunkEvaluator, { EvaluationResult } from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { AccessTransitionResult } from '@form-engine/core/nodes/transitions/access/AccessHandler'
import { SubmitTransitionResult } from '@form-engine/core/nodes/transitions/submit/SubmitHandler'
import { ActionTransitionResult } from '@form-engine/core/nodes/transitions/action/ActionHandler'
import {
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  ExpressionASTNode,
  SubmitTransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import getAncestorChain from '@form-engine/core/utils/getAncestorChain'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import RenderContextFactory from '@form-engine/core/runtime/rendering/RenderContextFactory'
import { JourneyMetadata } from '@form-engine/core/runtime/rendering/types'
import { ExpressionType } from '@form-engine/form/types/enums'
import { StepController } from './types'

/**
 * FormStepController - Handles the full request lifecycle for form steps
 *
 * Manages GET (access) and POST (submission) requests, including:
 * - Lifecycle transitions (onAccess, onAction, onSubmission)
 * - AST evaluation
 * - Response rendering or redirecting
 *
 * ## GET Request Flow
 * For each ancestor (outer journey → inner journey → step):
 * 1. Run onAccess transitions (data loading, access control, analytics)
 * 2. If any transition halts with redirect → redirect
 * 3. If any transition halts with error → return HTTP error
 * After all ancestors pass:
 * 4. Evaluate AST
 * 5. Render response
 *
 * ## POST Request Flow
 * 1. Run full access lifecycle (same as GET)
 * 2. Run step's onAction transitions (in-page actions like postcode lookup)
 * 3. Run step's onSubmission transitions (validation, navigation, error handling)
 * 4. If submission has error → return HTTP error
 * 5. If submission has redirect → redirect
 * 6. Otherwise → evaluate AST and render (with validation errors if applicable)
 */
export default class FormStepController<TRequest, TResponse> implements StepController<TRequest, TResponse> {
  constructor(
    private readonly compiledForm: CompiledForm[number],
    private readonly dependencies: FormInstanceDependencies,
    private readonly navigationMetadata: JourneyMetadata[],
    private readonly currentStepPath: string,
  ) {}

  /** Handle GET request: run access lifecycle, evaluate AST, render response. */
  async get(req: TRequest, res: TResponse): Promise<void> {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)

    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.compiledForm.artefact, this.dependencies)
    const context = evaluator.createContext(request, response)
    const ancestors = this.findLifecycleAncestors(context)

    for (const ancestor of ancestors) {
      this.mergeStaticData(ancestor, context)

      // eslint-disable-next-line no-await-in-loop
      const accessResult = await this.runAccessTransitions(evaluator, ancestor, context)

      if (accessResult.outcome === 'redirect') {
        return this.redirect(res, req, accessResult.redirect, context)
      }

      if (accessResult.outcome === 'error') {
        throw createHttpError(accessResult.status, accessResult.message || 'Access denied')
      }
    }

    // TODO: Add 'reachability' check

    await this.expandIteratorsForStep(evaluator, context)

    await this.evaluateAnswerPseudoNodes(evaluator, context)

    const evaluationResult = await evaluator.evaluate(context)

    return this.render(res, req, evaluationResult)
  }

  /** Handle POST request: run access lifecycle, action/submit transitions, render or redirect. */
  async post(req: TRequest, res: TResponse): Promise<void> {
    const request = this.dependencies.frameworkAdapter.toStepRequest(req)
    const response = this.dependencies.frameworkAdapter.toStepResponse(res)

    const evaluator = ThunkEvaluator.withRuntimeOverlay(this.compiledForm.artefact, this.dependencies)
    const context = evaluator.createContext(request, response)
    const ancestors = this.findLifecycleAncestors(context)

    for (const ancestor of ancestors) {
      this.mergeStaticData(ancestor, context)

      // eslint-disable-next-line no-await-in-loop
      const accessResult = await this.runAccessTransitions(evaluator, ancestor, context)

      if (accessResult.outcome === 'redirect') {
        return this.redirect(res, req, accessResult.redirect, context)
      }

      if (accessResult.outcome === 'error') {
        throw createHttpError(accessResult.status, accessResult.message || 'Access denied')
      }
    }

    // TODO: Add 'reachability' check

    await this.expandIteratorsForStep(evaluator, context)

    await this.evaluateAnswerPseudoNodes(evaluator, context)

    const currentStep = this.getCurrentStep(context)

    await this.runActionTransitions(evaluator, currentStep, context)

    const submitResult = await this.runSubmitTransitions(evaluator, currentStep, context)

    if (submitResult.outcome === 'error') {
      throw createHttpError(submitResult.status!, submitResult.message || 'Submission error')
    }

    if (submitResult.outcome === 'redirect') {
      return this.redirect(res, req, submitResult.redirect, context)
    }

    if (submitResult.validated) {
      const evaluationResult = await evaluator.evaluate(context)

      return this.render(res, req, evaluationResult, { showValidationFailures: true })
    }

    const evaluationResult = await evaluator.evaluate(context)

    return this.render(res, req, evaluationResult)
  }

  /** Redirect to a URL, resolving relative paths against the current base URL. */
  private redirect(res: TResponse, req: TRequest, redirect: string, _context: ThunkEvaluationContext): void {
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
   * Called before runAccessTransitions() so that:
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
   * Run onAccess transitions for an ancestor
   *
   * Transitions are evaluated in sequence. Each transition can:
   * - Execute effects (data loading, analytics)
   * - Continue to next transition (outcome: 'continue')
   * - Halt with redirect (outcome: 'redirect')
   * - Halt with error (outcome: 'error')
   *
   * @returns The final outcome - 'continue' if all transitions passed, or the halting outcome
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

      if (result.error) {
        this.dependencies.logger.warn(`Access transition error: ${result.error.message}`)
        // I can't come up with a way to do a promise in a loop, without using continue, and still have it be neat.
        // eslint-disable-next-line no-continue
        continue
      }

      // Skip if transition didn't execute (when condition was false)
      if (!result.value?.executed) {
        // eslint-disable-next-line no-continue
        continue
      }

      // Halt on redirect or error
      if (result.value.outcome === 'redirect' || result.value.outcome === 'error') {
        return result.value
      }
    }

    // All transitions completed - access granted
    return { executed: true, outcome: 'continue' }
  }

  /**
   * Run onAction transitions with first-match semantics
   * Effects are executed immediately during transition evaluation
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
        return result.value
      }
    }

    return { executed: false }
  }

  /**
   * Run onSubmission transitions with first-match semantics
   * Effects are executed immediately during transition evaluation
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
        return result.value
      }
    }

    return { executed: false, validated: false, outcome: 'continue' }
  }

  /**
   * Expand iterators on the current step to create runtime field nodes.
   *
   * This must run before evaluateAnswerPseudoNodes so that dynamic fields
   * (created by Iterator.Map) have their ANSWER_LOCAL pseudo
   * nodes registered before answer processing.
   *
   * Algorithm:
   * 1. Find all ITERATE nodes marked isDescendantOfStep
   * 2. For each, walk up to find the topmost ancestor under the step
   * 3. Evaluate that ancestor (cascades down with proper scope)
   * 4. Deduplicate to avoid evaluating shared ancestors twice
   */
  private async expandIteratorsForStep(
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    // Find all ITERATE nodes on the current step
    const iterateNodes = context.metadataRegistry
      .findNodesWhere('isDescendantOfStep', true)
      .map(nodeId => context.nodeRegistry.get(nodeId))
      .filter((node: ExpressionASTNode) => node.expressionType === ExpressionType.ITERATE)

    if (iterateNodes.length === 0) {
      return
    }

    // Find topmost ancestors under the step for each iterator
    const topmostAncestorIds = new Set<NodeId>()

    iterateNodes.forEach(iterateNodeId => {
      const topmostId = this.findTopmostAncestorUnderStep(iterateNodeId.id, context)

      if (topmostId) {
        topmostAncestorIds.add(topmostId)
      }
    })

    // Evaluate each unique topmost ancestor (cascades down to iterators)
    for (const ancestorId of topmostAncestorIds) {
      // eslint-disable-next-line no-await-in-loop
      await invoker.invoke(ancestorId, context)
    }
  }

  /**
   * Find the topmost ancestor of a node that is still under the current step.
   *
   * Walks up the parent chain via attachedToParentNode metadata until finding
   * a node whose parent is the step itself (marked isCurrentStep).
   */
  private findTopmostAncestorUnderStep(nodeId: NodeId, context: ThunkEvaluationContext): NodeId | undefined {
    let currentId: NodeId | undefined = nodeId
    let topmostId: NodeId | undefined

    while (currentId) {
      const parentId = context.metadataRegistry.get<NodeId>(currentId, 'attachedToParentNode')

      if (!parentId) {
        break
      }

      // Check if parent is the step itself
      const parentIsStep = context.metadataRegistry.get(parentId, 'isCurrentStep', false)

      if (parentIsStep) {
        // Current node is directly under the step - this is the topmost
        topmostId = currentId
        break
      }

      // Keep walking up
      topmostId = currentId
      currentId = parentId
    }

    return topmostId
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
}

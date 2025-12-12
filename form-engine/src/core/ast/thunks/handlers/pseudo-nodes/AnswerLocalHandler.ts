import { NodeId } from '@form-engine/core/types/engine.type'
import { AnswerLocalPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { isASTNode, isPseudoNode } from '@form-engine/core/typeguards/nodes'
import {
  AnswerHistory,
  AnswerSource,
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import ThunkLookupError from '@form-engine/errors/ThunkLookupError'

/**
 * Handler for ANSWER_LOCAL pseudo nodes
 *
 * Implements different resolution strategies based on request type:
 *
 * POST request (form submission)
 * 1. Check action-protected answers → return existing (protected from override)
 * 2. Record raw POST data → source: 'post'
 * 3. If formatPipeline exists, layer on processed value → source: 'processed'
 * 4. If dependent condition exists and is false → clear value, source: 'dependent'
 *
 * GET request (page load)
 * 1. Try existing answer (from previous submissions or onLoad effects)
 * 2. Fall back to defaultValue → source: 'default'
 *
 * Key distinction: On POST, we never fall back to existing answers OR defaults.
 * If a field isn't in POST data (e.g., unchecked checkboxes), that's the user's
 * submission - they cleared it. On GET, we show existing answers and defaults
 * so users can see their previous submissions or pre-populated values.
 *
 * Dependent fields: If a field has a `dependent` expression, it represents a
 * condition that must be true for the field's value to be kept. If the dependent
 * evaluates to false on POST, the answer is cleared with source 'dependent'.
 */
export default class AnswerLocalHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: AnswerLocalPseudoNode,
  ) {}

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult<unknown>> {
    const { baseFieldCode, fieldNodeId } = this.pseudoNode.properties

    if (!isSafePropertyKey(baseFieldCode)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, baseFieldCode, PseudoNodeType.ANSWER_LOCAL)
      return { error: error.toThunkError() }
    }

    const fieldNode = context.nodeRegistry.get(fieldNodeId) as FieldBlockASTNode

    if (!fieldNode) {
      const error = ThunkLookupError.node(fieldNodeId, this.nodeId)
      return { error: error.toThunkError() }
    }

    // Determine request type: POST submission vs GET page load
    const isPostSubmission = context.request.method === 'POST'

    if (isPostSubmission) {
      // Action-set answers are protected from override
      const existingHistory = context.global.answers[baseFieldCode]
      const lastMutation = existingHistory?.mutations.at(-1)

      if (lastMutation?.source === 'action') {
        return { value: existingHistory.current }
      }

      return this.resolveFromPost(context, invoker, fieldNode, baseFieldCode)
    }

    return this.resolveFromExisting(context, invoker, fieldNode, baseFieldCode)
  }

  /**
   * Resolve answer from POST data (form submission).
   * On POST, we use submitted data and fall back to default - never existing answers.
   */
  private async resolveFromPost(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): Promise<HandlerResult<unknown>> {
    // First, get the raw POST value
    const postPseudoNode = this.findPostPseudoNode(context, baseFieldCode)
    let rawValue: unknown

    if (postPseudoNode) {
      const postResult = await invoker.invoke(postPseudoNode.id, context)

      if (!postResult.error) {
        rawValue = postResult.value
      }
    }

    // Always record the raw POST mutation
    this.pushMutation(context, baseFieldCode, rawValue, 'post')

    // If there's a format pipeline, run it and layer on processed value
    const formatPipeline = fieldNode.properties.formatPipeline
    let resolvedValue = rawValue

    if (formatPipeline && isASTNode(formatPipeline)) {
      const pipelineResult = await invoker.invoke(formatPipeline.id, context)

      if (!pipelineResult.error && pipelineResult.value !== undefined) {
        this.pushMutation(context, baseFieldCode, pipelineResult.value, 'processed')
        resolvedValue = pipelineResult.value
      }
    }

    // After POST resolution, check if this field has a dependent condition
    // If dependent evaluates to false, clear the answer
    const dependent = fieldNode.properties.dependent

    if (dependent && isASTNode(dependent)) {
      const dependentResult = await invoker.invoke(dependent.id, context)

      if (!dependentResult.error && !dependentResult.value) {
        this.pushMutation(context, baseFieldCode, undefined, 'dependent')

        return { value: undefined }
      }
    }

    return { value: resolvedValue }
  }

  /**
   * Resolve answer from existing data (GET request / page load).
   * On GET, we show existing answers and fall back to default.
   */
  private async resolveFromExisting(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): Promise<HandlerResult<unknown>> {
    const existingHistory = context.global.answers[baseFieldCode]

    if (existingHistory?.current !== undefined) {
      return { value: existingHistory.current }
    }

    return this.resolveDefault(context, invoker, fieldNode, baseFieldCode)
  }

  /**
   * Resolve default value for a field.
   */
  private async resolveDefault(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): Promise<HandlerResult<unknown>> {
    const defaultValue = fieldNode.properties.defaultValue

    if (defaultValue && isASTNode(defaultValue)) {
      const defaultResult = await invoker.invoke(defaultValue.id, context)

      if (!defaultResult.error && defaultResult.value !== undefined) {
        this.pushMutation(context, baseFieldCode, defaultResult.value, 'default')
        return { value: defaultResult.value }
      }
    }

    if (defaultValue !== undefined && !isASTNode(defaultValue)) {
      this.pushMutation(context, baseFieldCode, defaultValue, 'default')
      return { value: defaultValue }
    }

    this.pushMutation(context, baseFieldCode, undefined, 'default')
    return { value: undefined }
  }

  /**
   * Push a mutation to the answer history
   */
  private pushMutation(context: ThunkEvaluationContext, code: string, value: unknown, source: AnswerSource): void {
    const history: AnswerHistory = context.global.answers[code] ?? { current: undefined, mutations: [] }

    history.mutations.push({ value, source })
    history.current = value
    context.global.answers[code] = history
  }

  /**
   * Find POST pseudo node for the given field code
   * Searches through the node registry for a POST pseudo node with matching baseFieldCode
   */
  private findPostPseudoNode(context: ThunkEvaluationContext, baseFieldCode: string) {
    // Search through all nodes in the registry for POST pseudo node
    const allEntries = context.nodeRegistry.getAll()

    return Array.from(allEntries.values()).find(
      node =>
        isPseudoNode(node) && node.type === PseudoNodeType.POST && node.properties.baseFieldCode === baseFieldCode,
    )
  }
}

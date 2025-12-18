import { NodeId } from '@form-engine/core/types/engine.type'
import { AnswerLocalPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import {
  AnswerHistory,
  AnswerSource,
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '@form-engine/core/ast/utils/propertyAccess'
import { sanitizeValue } from '@form-engine/core/ast/utils/sanitize'
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
 * 3. If sanitize !== false, sanitize string values → source: 'sanitized' (if changed)
 * 4. If formatPipeline exists, layer on processed value → source: 'processed'
 * 5. If dependent condition exists and is false → clear value, source: 'dependent'
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
 *
 * Sanitization: By default, string values are HTML entity encoded to prevent XSS.
 * Set `sanitize: false` on a field to allow raw HTML (e.g., for rich text editors).
 *
 * Synchronous when formatPipeline, dependent, and defaultValue are all sync (or absent).
 * Asynchronous when any of these expressions is async.
 */
export default class AnswerLocalHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: AnswerLocalPseudoNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { fieldNodeId } = this.pseudoNode.properties

    // Get field node from node registry to check its properties
    const fieldNode = deps.nodeRegistry.get(fieldNodeId) as FieldBlockASTNode | undefined

    if (!fieldNode) {
      // Can't find field node - be conservative
      this.isAsync = true
      return
    }

    // Check if formatPipeline, dependent, or defaultValue are async
    const formatPipeline = fieldNode.properties.formatPipeline
    const dependent = fieldNode.properties.dependent
    const defaultValue = fieldNode.properties.defaultValue

    // Helper: Check if an AST node's handler is async
    const isNodeAsync = (node: unknown): boolean => {
      if (!isASTNode(node)) {
        return false
      }

      const handler = deps.thunkHandlerRegistry.get(node.id)
      return handler?.isAsync ?? true // Conservative: assume async if not found
    }

    // AnswerLocalHandler is sync ONLY if all dependencies are sync
    this.isAsync = isNodeAsync(formatPipeline) || isNodeAsync(dependent) || isNodeAsync(defaultValue)
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<unknown> {
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

      return this.resolveFromPostSync(context, invoker, fieldNode, baseFieldCode)
    }

    return this.resolveFromExistingSync(context, invoker, fieldNode, baseFieldCode)
  }

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

    // Always record the raw POST mutation (preserves original for audit)
    this.pushMutation(context, baseFieldCode, rawValue, 'post')

    // Apply sanitization if enabled (defaults to true)
    // Sanitization happens BEFORE formatPipeline so formatters receive safe input
    const shouldSanitize = fieldNode.properties.sanitize !== false
    let sanitizedValue = rawValue

    if (shouldSanitize) {
      sanitizedValue = sanitizeValue(rawValue)

      // Only record sanitized mutation if value actually changed
      // This could be used to audit users being meanies and trying to run hax.
      if (sanitizedValue !== rawValue) {
        this.pushMutation(context, baseFieldCode, sanitizedValue, 'sanitized')
      }
    }

    // If there's a format pipeline, run it and layer on processed value
    const formatPipeline = fieldNode.properties.formatPipeline
    let resolvedValue = sanitizedValue

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
   * Sync version: Resolve answer from POST data (form submission)
   */
  private resolveFromPostSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): HandlerResult<unknown> {
    // First, get the raw POST value
    const postPseudoNode = this.findPostPseudoNode(context, baseFieldCode)
    let rawValue: unknown

    if (postPseudoNode) {
      const postResult = invoker.invokeSync(postPseudoNode.id, context)

      if (!postResult.error) {
        rawValue = postResult.value
      }
    }

    // Always record the raw POST mutation
    this.pushMutation(context, baseFieldCode, rawValue, 'post')

    // Apply sanitization
    const shouldSanitize = fieldNode.properties.sanitize !== false
    let sanitizedValue = rawValue

    if (shouldSanitize) {
      sanitizedValue = sanitizeValue(rawValue)

      if (sanitizedValue !== rawValue) {
        this.pushMutation(context, baseFieldCode, sanitizedValue, 'sanitized')
      }
    }

    // If there's a format pipeline, run it
    const formatPipeline = fieldNode.properties.formatPipeline
    let resolvedValue = sanitizedValue

    if (formatPipeline && isASTNode(formatPipeline)) {
      const pipelineResult = invoker.invokeSync(formatPipeline.id, context)

      if (!pipelineResult.error && pipelineResult.value !== undefined) {
        this.pushMutation(context, baseFieldCode, pipelineResult.value, 'processed')
        resolvedValue = pipelineResult.value
      }
    }

    // Check dependent condition
    const dependent = fieldNode.properties.dependent

    if (dependent && isASTNode(dependent)) {
      const dependentResult = invoker.invokeSync(dependent.id, context)

      if (!dependentResult.error && !dependentResult.value) {
        this.pushMutation(context, baseFieldCode, undefined, 'dependent')

        return { value: undefined }
      }
    }

    return { value: resolvedValue }
  }

  /**
   * Sync version: Resolve answer from existing data (GET request)
   */
  private resolveFromExistingSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): HandlerResult<unknown> {
    const existingHistory = context.global.answers[baseFieldCode]

    if (existingHistory?.current !== undefined) {
      return { value: existingHistory.current }
    }

    return this.resolveDefaultSync(context, invoker, fieldNode, baseFieldCode)
  }

  /**
   * Sync version: Resolve default value for a field
   */
  private resolveDefaultSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): HandlerResult<unknown> {
    const defaultValue = fieldNode.properties.defaultValue

    if (defaultValue && isASTNode(defaultValue)) {
      const defaultResult = invoker.invokeSync(defaultValue.id, context)

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
   * Uses O(1) indexed lookup instead of linear scan
   */
  private findPostPseudoNode(context: ThunkEvaluationContext, baseFieldCode: string) {
    return context.nodeRegistry.findPseudoNode(PseudoNodeType.POST, baseFieldCode)
  }
}

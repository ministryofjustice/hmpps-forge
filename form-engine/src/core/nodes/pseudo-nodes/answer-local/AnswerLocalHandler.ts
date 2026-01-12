import { NodeId } from '@form-engine/core/types/engine.type'
import { getPseudoNodeKey } from '@form-engine/core/ast/registration/pseudoNodeKeyExtractor'
import { AnswerLocalPseudoNode, PostPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
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
 * 2. Invoke POST pseudo node → get raw value
 * 3. Record raw POST data → source: 'post'
 * 4. Sanitize value (if sanitize !== false) → source: 'sanitized' (if changed)
 * 5. Execute formatters inline on sanitized value → source: 'processed'
 * 6. If dependent condition exists and is false → clear value, source: 'dependent'
 *
 * Note: Sanitization happens BEFORE formatters, ensuring formatters receive safe input.
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
 * Synchronous when formatters, dependent, and defaultValue are all sync (or absent).
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

    // Check if formatters, dependent, or defaultValue are async
    const formatters = fieldNode.properties.formatters
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

    // Check if any formatter is async
    const anyFormatterAsync = Array.isArray(formatters) && formatters.some(isNodeAsync)

    // AnswerLocalHandler is sync ONLY if all dependencies are sync
    this.isAsync = anyFormatterAsync || isNodeAsync(dependent) || isNodeAsync(defaultValue)
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
   * On POST, we use submitted data - never existing answers or defaults.
   *
   * Flow:
   * 1. Get raw value from POST pseudo node
   * 2. Sanitize (if enabled) - prevents XSS
   * 3. Execute formatters inline on sanitized value
   * 4. Check dependent condition
   */
  private async resolveFromPost(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): Promise<HandlerResult<unknown>> {
    // 1. Get raw POST value
    const postPseudoNode = this.findPostPseudoNode(context, baseFieldCode)
    let rawValue: unknown

    if (postPseudoNode) {
      const postResult = await invoker.invoke(postPseudoNode.id, context)

      if (!postResult.error) {
        rawValue = postResult.value
      }
    }

    // Record raw POST mutation (preserves original for audit)
    this.pushMutation(context, baseFieldCode, rawValue, 'post')

    // 2. Sanitize (if enabled)
    const shouldSanitize = fieldNode.properties.sanitize !== false
    let sanitizedValue = rawValue

    if (shouldSanitize) {
      sanitizedValue = sanitizeValue(rawValue)

      // Only record sanitized mutation if value actually changed
      if (sanitizedValue !== rawValue) {
        this.pushMutation(context, baseFieldCode, sanitizedValue, 'sanitized')
      }
    }

    // 3. Execute formatters inline on sanitized value
    let resolvedValue = sanitizedValue
    const formatters = fieldNode.properties.formatters

    if (Array.isArray(formatters) && formatters.length > 0) {
      for (const formatter of formatters) {
        if (isASTNode(formatter)) {
          // Push current value onto scope as @value
          // Tag as 'formatter' so ScopeReferenceHandler skips it when resolving Item() levels
          context.scope.push({ '@value': resolvedValue, '@type': 'formatter' })

          try {
            // eslint-disable-next-line no-await-in-loop
            const formatterResult = await invoker.invoke(formatter.id, context)

            if (!formatterResult.error && formatterResult.value !== undefined) {
              resolvedValue = formatterResult.value
            }
          } finally {
            context.scope.pop()
          }
        }
      }

      // Record processed mutation if formatters changed the value
      if (resolvedValue !== sanitizedValue) {
        this.pushMutation(context, baseFieldCode, resolvedValue, 'processed')
      }
    }

    // 4. Check dependent condition - if false, clear the answer
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
   *
   * Flow:
   * 1. Get raw value from POST pseudo node
   * 2. Sanitize (if enabled) - prevents XSS
   * 3. Execute formatters inline on sanitized value
   * 4. Check dependent condition
   */
  private resolveFromPostSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
    fieldNode: FieldBlockASTNode,
    baseFieldCode: string,
  ): HandlerResult<unknown> {
    // 1. Get raw POST value
    const postPseudoNode = this.findPostPseudoNode(context, baseFieldCode)
    let rawValue: unknown

    if (postPseudoNode) {
      const postResult = invoker.invokeSync(postPseudoNode.id, context)

      if (!postResult.error) {
        rawValue = postResult.value
      }
    }

    // Record raw POST mutation (preserves original for audit)
    this.pushMutation(context, baseFieldCode, rawValue, 'post')

    // 2. Sanitize (if enabled)
    const shouldSanitize = fieldNode.properties.sanitize !== false
    let sanitizedValue = rawValue

    if (shouldSanitize) {
      sanitizedValue = sanitizeValue(rawValue)

      // Only record sanitized mutation if value actually changed
      if (sanitizedValue !== rawValue) {
        this.pushMutation(context, baseFieldCode, sanitizedValue, 'sanitized')
      }
    }

    // 3. Execute formatters inline on sanitized value
    let resolvedValue = sanitizedValue
    const formatters = fieldNode.properties.formatters

    if (Array.isArray(formatters) && formatters.length > 0) {
      for (const formatter of formatters) {
        if (isASTNode(formatter)) {
          // Push current value onto scope as @value
          // Tag as 'formatter' so ScopeReferenceHandler skips it when resolving Item() levels
          context.scope.push({ '@value': resolvedValue, '@type': 'formatter' })

          try {
            const formatterResult = invoker.invokeSync(formatter.id, context)

            if (!formatterResult.error && formatterResult.value !== undefined) {
              resolvedValue = formatterResult.value
            }
          } finally {
            context.scope.pop()
          }
        }
      }

      // Record processed mutation if formatters changed the value
      if (resolvedValue !== sanitizedValue) {
        this.pushMutation(context, baseFieldCode, resolvedValue, 'processed')
      }
    }

    // 4. Check dependent condition - if false, clear the answer
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
   */
  private findPostPseudoNode(context: ThunkEvaluationContext, baseFieldCode: string) {
    return context.nodeRegistry.findByType<PostPseudoNode>(PseudoNodeType.POST)
      .find(node => getPseudoNodeKey(node) === baseFieldCode)
  }
}

import { NodeId } from '../../../types/engine.type'
import { getPseudoNodeKey } from '../../../utils/pseudoNodeKeyExtractor'
import { AnswerLocalPseudoNode, PostPseudoNode, PseudoNodeType } from '../../../types/pseudoNodes.type'
import { FieldBlockASTNode } from '../../../types/structures.type'
import { isASTNode } from '../../../typeguards/nodes'
import {
  AnswerHistory,
  AnswerSource,
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'
import { isSafePropertyKey } from '../../../utils/propertyAccess'
import ThunkEvaluationError from '../../../errors/ThunkEvaluationError'
import ThunkLookupError from '../../../errors/ThunkLookupError'

/**
 * Handler for ANSWER_LOCAL pseudo nodes
 *
 * Implements different resolution strategies based on request type:
 *
 * POST request (form submission)
 * 1. Check action-protected answers → return existing (protected from override)
 * 2. Invoke POST pseudo node → get raw value
 * 3. Record raw POST data → source: 'post'
 * 4. Execute formatters inline on value → source: 'processed'
 * 5. If dependentWhen condition exists and is false → clear value, source: 'dependentWhen'
 *
 * GET request (page load)
 * 1. Try existing answer (from onAccess effects)
 * 2. Fall back to defaultValue → source: 'default'
 *
 * Key distinction: On POST, we never fall back to existing answers OR defaults.
 * If a field isn't in POST data (e.g., unchecked checkboxes), that's the user's
 * submission - they cleared it. On GET, we show existing answers and defaults
 * so users can see their previous submissions or pre-populated values.
 *
 * Dependent fields: If a field has a `dependentWhen` expression, it represents a
 * condition that must be true for the field's value to be kept. If dependentWhen
 * evaluates to false on POST, the answer is cleared with source 'dependentWhen'.
 *
 * XSS Prevention: HTML escaping is handled at the rendering layer (components
 * and templates), not at input time. This preserves raw data and avoids
 * double-encoding issues.
 *
 * Synchronous when formatters, dependentWhen, and defaultValue are all sync (or absent).
 * Asynchronous when any of these expressions is async.
 */
export default class AnswerLocalHandler implements ThunkHandler {
  isAsync = false

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

    // Check if formatters, dependentWhen, or defaultValue are async
    const formatters = fieldNode.properties.formatters
    const dependentWhen = fieldNode.properties.dependentWhen
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
    this.isAsync = anyFormatterAsync || isNodeAsync(dependentWhen) || isNodeAsync(defaultValue)
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
   * 2. Execute formatters inline on value
   * 3. Check dependentWhen condition
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

    // 2. Execute formatters inline on value
    let resolvedValue = rawValue
    const formatters = fieldNode.properties.formatters

    if (Array.isArray(formatters) && formatters.length > 0) {
      for (const formatter of formatters) {
        if (isASTNode(formatter)) {
          // Push current value onto scope as @value
          // Tag as 'formatter' so ScopeReferenceHandler skips it when resolving Item() levels
          context.scope.push({ '@value': resolvedValue, '@type': 'formatter' })

          try {

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
      if (resolvedValue !== rawValue) {
        this.pushMutation(context, baseFieldCode, resolvedValue, 'processed')
      }
    }

    // 3. Check dependentWhen condition - if false, clear the answer
    const dependentWhen = fieldNode.properties.dependentWhen

    if (dependentWhen && isASTNode(dependentWhen)) {
      const dependentResult = await invoker.invoke(dependentWhen.id, context)

      if (!dependentResult.error && !dependentResult.value) {
        this.pushMutation(context, baseFieldCode, undefined, 'dependentWhen')

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
   * 2. Execute formatters inline on value
   * 3. Check dependentWhen condition
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

    // 2. Execute formatters inline on value
    let resolvedValue = rawValue
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
      if (resolvedValue !== rawValue) {
        this.pushMutation(context, baseFieldCode, resolvedValue, 'processed')
      }
    }

    // 3. Check dependentWhen condition - if false, clear the answer
    const dependentWhen = fieldNode.properties.dependentWhen

    if (dependentWhen && isASTNode(dependentWhen)) {
      const dependentResult = invoker.invokeSync(dependentWhen.id, context)

      if (!dependentResult.error && !dependentResult.value) {
        this.pushMutation(context, baseFieldCode, undefined, 'dependentWhen')

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

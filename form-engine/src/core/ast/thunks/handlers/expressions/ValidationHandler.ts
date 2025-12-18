import { NodeId } from '@form-engine/core/types/engine.type'
import { ValidationASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { evaluateOperand } from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Result of a validation evaluation
 */
export interface ValidationResult {
  /**
   * Whether the validation passed (when predicate is truthy)
   */
  passed: boolean

  /**
   * The error message to display when validation fails
   */
  message: string

  /**
   * Whether this validation should only run on submission
   */
  submissionOnly: boolean

  /**
   * Additional details about the validation
   */
  details?: Record<string, any>

  /**
   * Block code for grouping validation errors (e.g., GOV.UK error summary)
   */
  blockCode?: string
}

/**
 * Handler for Validation expression nodes
 *
 * Evaluates a validation expression by:
 * 1. Evaluating the 'when' predicate to determine if validation passes
 * 2. Evaluating the message (if it's an AST node)
 * 3. Evaluating the resolved block code (if it's an AST node)
 *
 * Returns a ValidationResult object with isValid, message, and metadata
 *
 * Synchronous when when predicate and message are sync.
 * Asynchronous when when predicate or message is async.
 */
export default class ValidationHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ValidationASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    // Check when predicate
    const whenHandler = deps.thunkHandlerRegistry.get(this.node.properties.when.id)
    const whenIsAsync = whenHandler?.isAsync ?? true

    // Check message
    let messageIsAsync = false

    if (isASTNode(this.node.properties.message)) {
      const messageHandler = deps.thunkHandlerRegistry.get(this.node.properties.message.id)

      messageIsAsync = messageHandler?.isAsync ?? true
    }

    // Async if when or message is async
    this.isAsync = whenIsAsync || messageIsAsync
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult<ValidationResult> {
    // Evaluate the 'when' predicate
    const predicateResult = invoker.invokeSync(this.node.properties.when.id, context)

    // Evaluate the message (needed for both success and error cases)
    let message: unknown

    if (isASTNode(this.node.properties.message)) {
      const result = invoker.invokeSync(this.node.properties.message.id, context)

      message = result.error ? undefined : result.value
    } else {
      message = this.node.properties.message
    }

    // If predicate evaluation fails, treat as invalid with the user's message
    if (predicateResult.error) {
      return {
        value: {
          passed: false,
          message: String(message ?? 'Validation error'),
          submissionOnly: this.node.properties.submissionOnly ?? false,
          details: this.node.properties.details,
        },
      }
    }

    return {
      value: {
        passed: !predicateResult.value,
        message: String(message ?? ''),
        submissionOnly: this.node.properties.submissionOnly ?? false,
        details: this.node.properties.details,
      },
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<ValidationResult>> {
    // Evaluate the 'when' predicate
    const predicateResult = await invoker.invoke(this.node.properties.when.id, context)

    // Evaluate the message (needed for both success and error cases)
    const message = await evaluateOperand(this.node.properties.message, context, invoker)

    // If predicate evaluation fails, treat as invalid with the user's message
    if (predicateResult.error) {
      return {
        value: {
          passed: false,
          message: String(message ?? 'Validation error'),
          submissionOnly: this.node.properties.submissionOnly ?? false,
          details: this.node.properties.details,
        },
      }
    }

    return {
      value: {
        passed: !predicateResult.value,
        message: String(message ?? ''),
        submissionOnly: this.node.properties.submissionOnly ?? false,
        details: this.node.properties.details,
      },
    }
  }
}

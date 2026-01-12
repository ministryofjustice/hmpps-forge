import { NodeId } from '@form-engine/core/types/engine.type'
import { FormatASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import { evaluateOperand } from '@form-engine/core/ast/thunks/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Handler for Format expression nodes
 *
 * Evaluates format expressions by:
 * 1. Evaluating all arguments (invoking AST nodes, preserving primitives)
 * 2. Substituting evaluated arguments into the template string
 * 3. Returning the formatted result
 *
 * ## Template Format
 * Templates use 1-indexed placeholders: %1, %2, %3, etc.
 * Example: "Hello %1, you have %2 ignored Slack messages" with args ["Tom", 500]
 * Result: "Hello Tom, you have 500 ignored Slack messages"
 *
 * ## Wiring Pattern
 * Arguments are wired as DATA_FLOW dependencies:
 * - arg[0] → format
 * - arg[1] → format
 * - etc.
 *
 * This ensures all arguments are evaluated before the format executes.
 *
 * Synchronous when all arguments are primitives or sync nodes.
 * Asynchronous when any argument is an async node.
 */
export default class FormatHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: FormatASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const rawArguments = this.node.properties.arguments

    // Check if any argument is async
    this.isAsync = rawArguments.some(arg => {
      if (isASTNode(arg)) {
        const handler = deps.thunkHandlerRegistry.get(arg.id)

        return handler?.isAsync ?? true
      }

      return false
    })
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const template = this.node.properties.template
    const rawArguments = this.node.properties.arguments

    // Evaluate all arguments (AST nodes invoked, primitives passed through)
    const evaluatedArguments = rawArguments.map(arg => {
      if (isASTNode(arg)) {
        const result = invoker.invokeSync(arg.id, context)

        return result.error ? undefined : result.value
      }

      return arg
    })

    // Substitute arguments into template
    try {
      const result = this.formatTemplate(template, evaluatedArguments)

      return { value: result }
    } catch (cause) {
      const wrappedCause = cause instanceof Error ? cause : new Error(String(cause))
      const error = ThunkEvaluationError.failed(this.nodeId, wrappedCause, 'FormatHandler')

      return { error: error.toThunkError() }
    }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const template = this.node.properties.template
    const rawArguments = this.node.properties.arguments

    // Evaluate all arguments (AST nodes invoked, primitives passed through)
    const evaluatedArguments = await Promise.all(rawArguments.map(arg => evaluateOperand(arg, context, invoker)))

    // Substitute arguments into template
    try {
      const result = this.formatTemplate(template, evaluatedArguments)

      return { value: result }
    } catch (cause) {
      const wrappedCause = cause instanceof Error ? cause : new Error(String(cause))
      const error = ThunkEvaluationError.failed(this.nodeId, wrappedCause, 'FormatHandler')

      return { error: error.toThunkError() }
    }
  }

  /**
   * Format a template string with evaluated arguments
   *
   * Replaces %1, %2, %3, etc. with corresponding argument values.
   * Placeholders are 1-indexed (first argument replaces %1).
   * Missing arguments are replaced with empty string.
   */
  private formatTemplate(template: string, args: unknown[]): string {
    return template.replace(/%(\d+)/g, (match, index) => {
      const argIndex = parseInt(index, 10) - 1

      if (argIndex < 0 || argIndex >= args.length) {
        return ''
      }

      const value = args[argIndex]

      if (value === undefined || value === null) {
        return ''
      }

      return String(value)
    })
  }
}

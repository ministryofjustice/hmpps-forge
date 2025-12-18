import { NodeId } from '@form-engine/core/types/engine.type'
import { PipelineASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import {
  evaluateOperandWithErrorTracking,
  evaluateWithScope,
} from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Handler for Pipeline expression nodes
 *
 * Evaluates a pipeline by:
 * 1. Evaluating the input expression
 * 2. Passing the input value through each transformation step sequentially
 * 3. Each step receives the output of the previous step via scope (@value)
 * 4. Returning the final transformed value
 *
 * Pipeline structure:
 * - input: The initial value expression (AST node or primitive)
 * - steps: Array of transformer functions to apply sequentially
 *
 * Scope mechanism:
 * - Before each step, pushes the current value onto scope as @value
 * - Transformer functions receive this value as their first parameter
 * - Scope is popped after each step completes
 *
 * Error handling:
 * - If input evaluation fails, returns error
 * - If any step evaluation fails, returns error
 * - Pipeline stops at first error
 *
 * Synchronous when input and all steps are sync.
 * Asynchronous when input or any step is async.
 */
export default class PipelineHandler implements HybridThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: PipelineASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { input, steps } = this.node.properties

    // Check if input is async
    let inputIsAsync = false

    if (isASTNode(input)) {
      const inputHandler = deps.thunkHandlerRegistry.get(input.id)

      inputIsAsync = inputHandler?.isAsync ?? true
    }

    // Check if any step is async
    const anyStepIsAsync = steps.some(step => {
      if (isASTNode(step)) {
        const stepHandler = deps.thunkHandlerRegistry.get(step.id)

        return stepHandler?.isAsync ?? true
      }

      return false
    })

    // Async if input is async OR any step is async
    this.isAsync = inputIsAsync || anyStepIsAsync
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const input = this.node.properties.input
    const steps = this.node.properties.steps

    // Evaluate the input expression
    let currentValue: unknown

    if (isASTNode(input)) {
      const result = invoker.invokeSync(input.id, context)

      if (result.error) {
        const error = ThunkEvaluationError.failed(
          this.nodeId,
          new Error('Pipeline input evaluation failed'),
          'PipelineHandler',
        )

        return { error: error.toThunkError() }
      }

      currentValue = result.value
    } else {
      currentValue = input
    }

    // Apply each transformation step sequentially
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]

      // Push current value onto scope
      context.scope.push({ '@value': currentValue })

      try {
        if (isASTNode(step)) {
          const result = invoker.invokeSync(step.id, context)

          if (result.error) {
            const error = ThunkEvaluationError.failed(
              this.nodeId,
              new Error(`Pipeline step ${i} evaluation failed`),
              'PipelineHandler',
            )

            return { error: error.toThunkError() }
          }

          currentValue = result.value
        } else {
          currentValue = step
        }
      } finally {
        context.scope.pop()
      }
    }

    return { value: currentValue }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const input = this.node.properties.input
    const steps = this.node.properties.steps

    // Evaluate the input expression
    const inputResult = await evaluateOperandWithErrorTracking(input, context, invoker)

    if (inputResult.failed) {
      const error = ThunkEvaluationError.failed(
        this.nodeId,
        new Error('Pipeline input evaluation failed'),
        'PipelineHandler',
      )

      return { error: error.toThunkError() }
    }

    // Apply each transformation step sequentially
    let currentValue = inputResult.value

    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]

      // eslint-disable-next-line no-await-in-loop
      const stepResult = await evaluateWithScope({ '@value': currentValue }, context, () =>
        evaluateOperandWithErrorTracking(step, context, invoker),
      )

      if (stepResult.failed) {
        const error = ThunkEvaluationError.failed(
          this.nodeId,
          new Error(`Pipeline step ${i} evaluation failed`),
          'PipelineHandler',
        )

        return { error: error.toThunkError() }
      }

      currentValue = stepResult.value
    }

    return { value: currentValue }
  }
}

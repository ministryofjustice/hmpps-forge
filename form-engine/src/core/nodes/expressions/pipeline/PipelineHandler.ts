import { NodeId } from '@form-engine/core/types/engine.type'
import { PipelineASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'
import { evaluateOperandWithErrorTracking, evaluateWithScope } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import {
  evaluateOperandWithErrorTrackingSync,
  evaluateWithScopeSync,
} from '@form-engine/core/utils/thunkEvaluatorsSync'
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
export default class PipelineHandler implements ThunkHandler {
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
    const inputResult = evaluateOperandWithErrorTrackingSync(input, context, invoker)

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

      // Tag as 'pipeline' so ScopeReferenceHandler skips it when resolving Item() levels
      const stepResult = evaluateWithScopeSync({ '@value': currentValue, '@type': 'pipeline' }, context, () =>
        evaluateOperandWithErrorTrackingSync(step, context, invoker),
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

      // Tag as 'pipeline' so ScopeReferenceHandler skips it when resolving Item() levels
      // eslint-disable-next-line no-await-in-loop
      const stepResult = await evaluateWithScope({ '@value': currentValue, '@type': 'pipeline' }, context, () =>
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

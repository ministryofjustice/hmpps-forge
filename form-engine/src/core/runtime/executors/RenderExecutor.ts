import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '@form-engine/core/compilation/thunks/types'
import { BlockASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { evaluatePropertyValue } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluatePropertyValueSync } from '@form-engine/core/utils/thunkEvaluatorsSync'
import { Evaluated } from '@form-engine/core/runtime/rendering/types'

/**
 * RenderExecutor - Evaluates the current step's block tree
 *
 * This targets only the block content for the current step body.
 */
export default class RenderExecutor {
  constructor() {}

  async execute(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<Evaluated<BlockASTNode>[]> {
    const blocks = this.getBlocks(runtimePlan, context)

    return (await evaluatePropertyValue(blocks, context, invoker)) as Evaluated<BlockASTNode>[]
  }

  executeSync(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Evaluated<BlockASTNode>[] {
    const blocks = this.getBlocks(runtimePlan, context)

    return evaluatePropertyValueSync(blocks, context, invoker) as Evaluated<BlockASTNode>[]
  }

  private getBlocks(runtimePlan: StepRuntimePlan, context: ThunkEvaluationContext): BlockASTNode[] {
    const stepNode = context.nodeRegistry.get(runtimePlan.renderStepId) as StepASTNode | undefined

    if (!stepNode) {
      throw new Error(`Step not found for block rendering: ${runtimePlan.renderStepId}`)
    }

    return stepNode.properties.blocks ?? []
  }
}

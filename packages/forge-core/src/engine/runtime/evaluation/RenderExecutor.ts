import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { BlockASTNode, StepASTNode } from '../../types/structures.type'
import { evaluatePropertyValue } from '../../utils/thunkEvaluatorsAsync'
import { Evaluated } from '../../../framework/rendering/types'

/**
 * RenderExecutor - Evaluates the current step's block tree
 *
 * This targets only the block content for the current step body.
 */
export default class RenderExecutor {

  async execute(
    runtimePlan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<Evaluated<BlockASTNode>[]> {
    const blocks = this.getBlocks(runtimePlan, context)

    return (await evaluatePropertyValue(blocks, context, invoker)) as Evaluated<BlockASTNode>[]
  }

  private getBlocks(runtimePlan: StepRuntimePlan, context: ThunkEvaluationContext): BlockASTNode[] {
    const stepNode = context.nodeRegistry.get(runtimePlan.renderStepId) as StepASTNode | undefined

    if (!stepNode) {
      throw new Error(`Step not found for block rendering: ${runtimePlan.renderStepId}`)
    }

    return stepNode.properties.blocks ?? []
  }
}

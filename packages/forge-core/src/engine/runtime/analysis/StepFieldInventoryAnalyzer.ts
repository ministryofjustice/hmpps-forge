import { ReachabilityRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { FieldBlockASTNode } from '../../types/structures.type'
import { BlockType } from '../../../authoring/types/enums'
import getAncestorChain from '../../utils/getAncestorChain'
import { StepFieldInventory } from '../types/StepFieldInventory.type'

/**
 * Discovers which field codes belong to each step by expanding field iterators
 * and querying the node registry.
 *
 * This is step answer ownership and discovery, not navigation.
 */
export default class StepFieldInventoryAnalyzer {
  async analyze(
    plan: ReachabilityRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<StepFieldInventory[]> {
    await this.expandFieldIterators(plan, invoker, context)

    return this.collectFieldCodes(plan, context)
  }

  private async expandFieldIterators(
    plan: ReachabilityRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<void> {
    for (const entry of plan.entries) {
      for (const rootId of entry.fieldIteratorRootIds) {
        // eslint-disable-next-line no-await-in-loop
        await invoker.invoke(rootId, context)
      }
    }
  }

  private collectFieldCodes(plan: ReachabilityRuntimePlan, context: ThunkEvaluationContext): StepFieldInventory[] {
    const fieldBlocks = context.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)

    return plan.entries.map(entry => {
      const fieldCodes = fieldBlocks
        .filter(block => {
          const ancestors = getAncestorChain(block.id, context.metadataRegistry)

          return ancestors.includes(entry.stepId)
        })
        .map(block => block.properties.code)
        .filter((code): code is string => typeof code === 'string')

      return {
        stepId: entry.stepId,
        fieldCodes: [...new Set(fieldCodes)],
        cleardownFieldCodes: entry.cleardownFieldCodes,
      }
    })
  }
}

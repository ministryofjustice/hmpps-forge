import { ReachabilityRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { FieldBlockASTNode } from '../../types/structures.type'
import { BlockType } from '../../../authoring/types/enums'
import { StepFieldInventory } from './StepFieldInventory.type'

export default class StepFieldInventoryAnalyzer {
  analyze(plan: ReachabilityRuntimePlan, context: ThunkEvaluationContext): StepFieldInventory[] {
    const fieldBlocks = context.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)

    return plan.entries.map(entry => {
      const fieldCodes = fieldBlocks
        .filter(block => context.astNodeTree.isDescendantOf(block.id, entry.stepId))
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

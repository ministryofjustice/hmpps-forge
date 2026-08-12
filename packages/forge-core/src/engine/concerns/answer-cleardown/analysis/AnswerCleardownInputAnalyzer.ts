import type { AnswerCleardownInputs } from '../../../contracts/plans/compilationPlan.type'
import type { ReachabilityCompilationPlan } from '../../../contracts/plans/runtimePlans.type'
import type FieldInventoryAnalyzer from '../../../compilation/dependency-analysis/shared/FieldInventoryAnalyzer'

export default class AnswerCleardownInputAnalyzer {
  constructor(private readonly fieldInventoryAnalyzer: FieldInventoryAnalyzer) {}

  buildInputs(plan: ReachabilityCompilationPlan): AnswerCleardownInputs {
    return {
      fieldInventorySources: plan.entries.map(entry => ({
        stepId: entry.stepId,
        cleardownFieldCodes: entry.cleardownFieldCodes,
        fieldBlocks: this.fieldInventoryAnalyzer.findFieldBlocksForStep(entry.stepId),
        iterateNodes: this.fieldInventoryAnalyzer.findMapIterateNodesForStep(entry.stepId),
      })),
    }
  }
}

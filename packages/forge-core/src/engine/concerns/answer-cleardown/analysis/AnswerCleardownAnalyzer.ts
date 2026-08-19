import type {
  JourneyAnalysisContext,
  JourneyModelAnalyzer,
} from '../../../chassis/compilation/analysis/concernAnalyzers.type'
import type { CleardownModel } from '../contracts/cleardownModel.type'

export default class AnswerCleardownAnalyzer implements JourneyModelAnalyzer<CleardownModel> {
  analyzeJourney(context: JourneyAnalysisContext): CleardownModel {
    const { stepNodes, ownership, labels } = context
    const inventoryNodes = stepNodes.flatMap(stepNode => [
      ...ownership.fieldBlocksOf(stepNode.id),
      ...ownership.mapIterateNodesOf(stepNode.id),
    ])

    return {
      label: labels.labelFrom(inventoryNodes, { maxDepth: 1 }),
      steps: stepNodes.map(stepNode => ({
        stepId: stepNode.id,
        fields: context.stepFields.get(stepNode.id) ?? [],
        cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      })),
    }
  }
}

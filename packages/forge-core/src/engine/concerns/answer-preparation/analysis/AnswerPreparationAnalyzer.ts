import type {
  JourneyAnalysisContext,
  JourneyModelAnalyzer,
  StepAnalysisContext,
  StepModelAnalyzer,
} from '../../../chassis/compilation/analysis/concernAnalyzers.type'
import type { FieldModel } from '../../../chassis/contracts/models/fieldModel.type'
import type { AnswerPreparationModel } from '../contracts/answerPreparationModel.type'

export default class AnswerPreparationAnalyzer
  implements StepModelAnalyzer<AnswerPreparationModel>, JourneyModelAnalyzer<AnswerPreparationModel>
{
  analyzeStep(context: StepAnalysisContext): AnswerPreparationModel {
    const { stepNode, ownership, labels } = context

    return {
      label: labels.labelFrom([
        stepNode,
        ...ownership.fieldBlocksOf(stepNode.id),
        ...ownership.mapIterateNodesOf(stepNode.id),
      ]),
      fields: context.fields,
    }
  }

  /** The journey model combines fields from all owned steps, preserving step order. */
  analyzeJourney(context: JourneyAnalysisContext): AnswerPreparationModel {
    const { stepNodes, ownership, labels } = context
    const inventoryNodes = stepNodes.flatMap(stepNode => [
      ...ownership.fieldBlocksOf(stepNode.id),
      ...ownership.mapIterateNodesOf(stepNode.id),
    ])
    const fields = stepNodes.flatMap((stepNode): readonly FieldModel[] => context.stepFields.get(stepNode.id) ?? [])

    return {
      label: labels.labelFrom(inventoryNodes),
      fields,
    }
  }
}

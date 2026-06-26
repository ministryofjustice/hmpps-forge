import type { NodeId } from '../../../contracts/ast/ast.type'
import type { StepASTNode } from '../../../contracts/ast/structures.type'
import type { AnswerPreparationInputs, JourneyCompilationInputs } from '../../../contracts/plans/compilationPlan.type'
import type FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'

export default class AnswerPreparationInputAnalyzer {
  constructor(private readonly fieldInventoryAnalyzer: FieldInventoryAnalyzer) {}

  buildInputs(stepNode: StepASTNode): AnswerPreparationInputs {
    return {
      fieldBlocks: this.fieldInventoryAnalyzer.findFieldBlocksForStep(stepNode.id),
      mapIterateNodes: this.fieldInventoryAnalyzer.findMapIterateNodesForStep(stepNode.id),
    }
  }

  buildJourneyInputs(stepIds: NodeId[]): Pick<JourneyCompilationInputs, 'stepFieldBlocks' | 'stepMapIterateNodes'> {
    return {
      stepFieldBlocks: stepIds.flatMap(stepId => this.fieldInventoryAnalyzer.findFieldBlocksForStep(stepId)),
      stepMapIterateNodes: stepIds.flatMap(stepId => this.fieldInventoryAnalyzer.findMapIterateNodesForStep(stepId)),
    }
  }
}

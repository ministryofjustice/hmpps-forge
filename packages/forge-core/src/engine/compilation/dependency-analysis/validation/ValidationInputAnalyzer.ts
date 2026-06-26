import type { StepASTNode } from '../../../contracts/ast/structures.type'
import type { ValidationInputs } from '../../../contracts/plans/compilationPlan.type'
import type FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'

export default class ValidationInputAnalyzer {
  constructor(private readonly fieldInventoryAnalyzer: FieldInventoryAnalyzer) {}

  buildInputs(stepNode: StepASTNode): ValidationInputs {
    return {
      stepNode,
      validatingFieldBlocks: this.fieldInventoryAnalyzer.findValidatingFieldBlocksForStep(stepNode.id),
      mapIterateNodes: this.fieldInventoryAnalyzer.findMapIterateNodesForStep(stepNode.id),
    }
  }
}

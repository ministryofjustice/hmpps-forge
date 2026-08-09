import type { StepASTNode } from '../../../contracts/ast/structures.type'
import type { ValidationInputs } from '../../../contracts/plans/compilationPlan.type'
import type FieldInventoryAnalyzer from '../../../compilation/dependency-analysis/shared/FieldInventoryAnalyzer'

export default class ValidationInputAnalyzer {
  constructor(private readonly fieldInventoryAnalyzer: FieldInventoryAnalyzer) {}

  buildInputs(stepNode: StepASTNode): ValidationInputs {
    return {
      stepNode,
      hasValidation:
        this.fieldInventoryAnalyzer.hasValidationBlocks(stepNode.id) ||
        this.fieldInventoryAnalyzer.hasConfiguredValue(stepNode.properties.validWhen),
      validatingFieldBlocks: this.fieldInventoryAnalyzer.findValidatingFieldBlocksForStep(stepNode.id),
      mapIterateNodes: this.fieldInventoryAnalyzer.findMapIterateNodesForStep(stepNode.id),
    }
  }
}

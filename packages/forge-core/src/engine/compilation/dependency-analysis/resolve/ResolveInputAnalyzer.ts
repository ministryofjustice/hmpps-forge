import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { ResolveInputs } from '../../../contracts/plans/compilationPlan.type'
import type FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'

export default class ResolveInputAnalyzer {
  constructor(private readonly fieldInventoryAnalyzer: FieldInventoryAnalyzer) {}

  buildInputs(stepNode: StepASTNode): ResolveInputs {
    return {
      stepNode,
      ancestorJourneys: this.resolveAncestorJourneys(stepNode),
      allIterateNodes: this.fieldInventoryAnalyzer.findAllIterateNodesForStep(stepNode.id),
    }
  }

  // Ancestor journeys, root-first, excluding the step itself.
  private resolveAncestorJourneys(stepNode: StepASTNode): JourneyASTNode[] {
    const journeys: JourneyASTNode[] = []
    let current: ASTNode | undefined = stepNode.parent

    while (current !== undefined) {
      if (this.isJourneyNode(current)) {
        journeys.push(current)
      }

      current = current.parent
    }

    journeys.reverse()

    return journeys
  }

  private isJourneyNode(node: ASTNode): node is JourneyASTNode {
    return node.type === ASTNodeType.JOURNEY
  }
}

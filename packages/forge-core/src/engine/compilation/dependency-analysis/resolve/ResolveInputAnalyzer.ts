import type { ASTNode, NodeId } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { ResolveInputs } from '../../../contracts/plans/compilationPlan.type'
import type ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import type ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import getAncestorChain from '../../ast/ast-state/getAncestorChain'
import type FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'

export default class ResolveInputAnalyzer {
  constructor(
    private readonly nodeRegistry: ASTNodeIndex,
    private readonly astNodeTree: ASTNodeTree,
    private readonly fieldInventoryAnalyzer: FieldInventoryAnalyzer,
  ) {}

  buildInputs(stepNode: StepASTNode): ResolveInputs {
    return {
      stepNode,
      ancestorJourneys: this.resolveAncestorJourneys(stepNode.id),
      allIterateNodes: this.fieldInventoryAnalyzer.findAllIterateNodesForStep(stepNode.id),
    }
  }

  private resolveAncestorJourneys(stepId: NodeId): JourneyASTNode[] {
    return getAncestorChain(stepId, this.astNodeTree)
      .slice(0, -1)
      .map(ancestorId => this.nodeRegistry.get(ancestorId))
      .filter(this.isJourneyNode)
  }

  private isJourneyNode(node: ASTNode | undefined): node is JourneyASTNode {
    return node?.type === ASTNodeType.JOURNEY
  }
}

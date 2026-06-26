import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import type { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import type { ReachabilityCompilationPlan } from '../../../contracts/plans/runtimePlans.type'
import type { FieldInventoryStepSource } from '../../../contracts/plans/compilationPlan.type'
import type ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import type ASTNodeTree from '../../ast/ast-state/ASTNodeTree'

export default class FieldInventoryAnalyzer {
  private readonly allFieldBlocks: FieldBlockASTNode[]

  private readonly allMapIterateNodes: IterateASTNode[]

  private readonly allIterateNodes: IterateASTNode[]

  constructor(
    private readonly nodeRegistry: ASTNodeIndex,
    private readonly astNodeTree: ASTNodeTree,
  ) {
    this.allFieldBlocks = this.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    this.allMapIterateNodes = this.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)
    this.allIterateNodes = this.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
  }

  findFieldBlocksForStep(stepId: NodeId): FieldBlockASTNode[] {
    return this.allFieldBlocks.filter(block => this.astNodeTree.isDescendantOf(block.id, stepId))
  }

  findValidatingFieldBlocksForStep(stepId: NodeId): FieldBlockASTNode[] {
    return this.findFieldBlocksForStep(stepId)
      .filter(block => this.hasConfiguredValue(block.properties.validWhen))
  }

  findMapIterateNodesForStep(stepId: NodeId): IterateASTNode[] {
    return this.allMapIterateNodes.filter(node => this.astNodeTree.isDescendantOf(node.id, stepId))
  }

  findAllIterateNodesForStep(stepId: NodeId): IterateASTNode[] {
    return this.allIterateNodes.filter(node => this.astNodeTree.isDescendantOf(node.id, stepId))
  }

  buildFieldInventorySources(plan: ReachabilityCompilationPlan): FieldInventoryStepSource[] {
    return plan.entries.map(entry => ({
      stepId: entry.stepId,
      cleardownFieldCodes: entry.cleardownFieldCodes,
      fieldBlocks: this.findFieldBlocksForStep(entry.stepId),
      iterateNodes: this.findMapIterateNodesForStep(entry.stepId),
    }))
  }

  hasValidationBlocks(stepId: NodeId): boolean {
    return this.findFieldBlocksForStep(stepId)
      .some(block => this.hasConfiguredValue(block.properties.validWhen))
  }

  hasConfiguredValue(value: unknown): boolean {
    if (value === undefined) {
      return false
    }

    if (Array.isArray(value)) {
      return value.length > 0
    }

    return true
  }
}

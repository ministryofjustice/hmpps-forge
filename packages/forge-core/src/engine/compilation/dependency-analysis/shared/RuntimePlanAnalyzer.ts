import { normalizeRelativePath } from '../../../../framework/path/routePath'
import type { ASTNode, NodeId } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { JourneyRuntimePlan, StepRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import type ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import getAncestorChain from '../../ast/ast-state/getAncestorChain'

export default class RuntimePlanAnalyzer {
  constructor(
    private readonly nodeRegistry: ASTNodeIndex,
    private readonly astNodeTree: ASTNodeTree,
  ) {}

  buildStepRuntimePlan(stepNode: StepASTNode): StepRuntimePlan {
    return {
      stepId: stepNode.id,
      path: normalizeRelativePath(stepNode.properties.path),
      staticData: this.resolveStaticData(stepNode.id),
    }
  }

  buildJourneyRuntimePlan(journeyNode: JourneyASTNode): JourneyRuntimePlan {
    return {
      journeyId: journeyNode.id,
      path: normalizeRelativePath(journeyNode.properties.path),
      staticData: this.resolveStaticData(journeyNode.id),
    }
  }

  resolveStaticData(nodeId: NodeId): Record<string, unknown> {
    const ancestorIds = this.resolveAncestorIds(nodeId)

    return (
      ancestorIds
        .map(ancestorId => this.getStaticDataNode(ancestorId)).reduce<Record<string, unknown>>((data, node) => {
          const staticData = node.properties.data

          if (staticData === undefined) {
            return data
          }

          return { ...data, ...staticData }
        }, {})
    )
  }

  resolveAncestorIds(nodeId: NodeId): NodeId[] {
    return getAncestorChain(nodeId, this.astNodeTree)
  }

  private getStaticDataNode(nodeId: NodeId): JourneyASTNode | StepASTNode {
    const node = this.nodeRegistry.get(nodeId)

    if (!this.isStaticDataNode(node)) {
      throw new Error(`Static data ancestor "${nodeId}" was not registered as a journey or step`)
    }

    return node
  }

  private isStaticDataNode(node: ASTNode | undefined): node is JourneyASTNode | StepASTNode {
    return node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP
  }
}

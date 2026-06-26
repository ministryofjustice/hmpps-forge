import type { ASTNode, NodeId } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { AccessHookASTNode } from '../../../contracts/ast/expressions.type'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { HookInputs } from '../../../contracts/plans/compilationPlan.type'
import type ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import type ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import getAncestorChain from '../../ast/ast-state/getAncestorChain'

export default class HookInputAnalyzer {
  constructor(
    private readonly nodeRegistry: ASTNodeIndex,
    private readonly astNodeTree: ASTNodeTree,
  ) {}

  buildInputs(stepNode: StepASTNode): HookInputs {
    return {
      accessHooks: this.resolveAccessHooks(stepNode.id),
      submitHooks: stepNode.properties.onSubmission ?? [],
    }
  }

  resolveAccessHooks(nodeId: NodeId): AccessHookASTNode[] {
    return getAncestorChain(nodeId, this.astNodeTree)
      .map(ancestorId => this.nodeRegistry.get(ancestorId))
      .filter(this.isAccessAncestor)
      .flatMap(ancestor => ancestor.properties.onAccess ?? [])
  }

  private isAccessAncestor(node: ASTNode | undefined): node is JourneyASTNode | StepASTNode {
    return node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP
  }
}

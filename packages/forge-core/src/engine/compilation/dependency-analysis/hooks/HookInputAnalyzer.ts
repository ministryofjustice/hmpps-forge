import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { AccessHookASTNode } from '../../../contracts/ast/expressions.type'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { HookInputs } from '../../../contracts/plans/compilationPlan.type'

export default class HookInputAnalyzer {
  buildInputs(stepNode: StepASTNode): HookInputs {
    return {
      accessHooks: this.resolveAccessHooks(stepNode),
      submitHooks: stepNode.properties.onSubmission ?? [],
    }
  }

  // Access hooks flatten root-first, so an outer journey's hooks run before an inner node's.
  resolveAccessHooks(node: JourneyASTNode | StepASTNode): AccessHookASTNode[] {
    const ancestors: (JourneyASTNode | StepASTNode)[] = []
    let current: ASTNode | undefined = node

    while (current !== undefined) {
      if (this.isAccessAncestor(current)) {
        ancestors.push(current)
      }

      current = current.parent
    }

    ancestors.reverse()

    return ancestors.flatMap(ancestor => ancestor.properties.onAccess ?? [])
  }

  private isAccessAncestor(node: ASTNode): node is JourneyASTNode | StepASTNode {
    return node.type === ASTNodeType.JOURNEY || node.type === ASTNodeType.STEP
  }
}

import { normalizeRelativePath } from '../../../../shared/utils/routePath'
import type { ASTNode } from '../../../contracts/ast/ast.type'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { JourneyRuntimePlan, StepRuntimePlan } from '../../../contracts/plans/runtimePlans.type'

export default class RuntimePlanAnalyzer {
  buildStepRuntimePlan(stepNode: StepASTNode): StepRuntimePlan {
    return {
      stepId: stepNode.id,
      path: normalizeRelativePath(stepNode.properties.path),
    }
  }

  buildJourneyRuntimePlan(journeyNode: JourneyASTNode): JourneyRuntimePlan {
    return {
      journeyId: journeyNode.id,
      path: normalizeRelativePath(journeyNode.properties.path),
    }
  }

  // Ancestor static data merges root-first so a descendant's `data` overrides its ancestors'.
  resolveStaticData(node: JourneyASTNode | StepASTNode): Record<string, unknown> {
    const ancestors: ASTNode[] = []
    let current: ASTNode | undefined = node

    while (current !== undefined) {
      ancestors.push(current)
      current = current.parent
    }

    ancestors.reverse()

    return ancestors.reduce<Record<string, unknown>>((data, ancestor) => {
      const staticData = ancestor.properties?.data

      if (staticData === undefined) {
        return data
      }

      return { ...data, ...staticData }
    }, {})
  }
}

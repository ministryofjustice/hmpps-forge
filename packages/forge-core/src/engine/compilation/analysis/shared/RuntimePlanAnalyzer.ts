import { normalizeRelativePath } from '../../../../shared/utils/routePath'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { JourneyRuntimePlan, StepRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import Ancestry from './Ancestry'

export default class RuntimePlanAnalyzer {
  constructor(private readonly ancestry: Ancestry = new Ancestry()) {}

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
    return this.ancestry.valuesRootFirst<Record<string, unknown>>(node, ancestor => ancestor.properties?.data)
      .reduce((data, staticData) => ({ ...data, ...staticData }), {})
  }
}

import { normalizeRelativePath } from '../../../../../shared/routePath'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { JourneyMountInfo, StepMountInfo } from '../../../contracts/plans/mountInfo.type'
import Ancestry from './Ancestry'

export default class MountInfoAnalyzer {
  constructor(private readonly ancestry: Ancestry = new Ancestry()) {}

  buildStepMountInfo(stepNode: StepASTNode): StepMountInfo {
    return {
      stepId: stepNode.id,
      path: normalizeRelativePath(stepNode.properties.path),
    }
  }

  buildJourneyMountInfo(journeyNode: JourneyASTNode): JourneyMountInfo {
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

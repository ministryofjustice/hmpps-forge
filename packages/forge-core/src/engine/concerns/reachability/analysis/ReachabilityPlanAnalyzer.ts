import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type {
  ReachabilityStateTable,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
} from '../../../contracts/plans/runtimePlans.type'
import ForwardNavigationAnalyzer from './ForwardNavigationAnalyzer'

export default class ReachabilityPlanAnalyzer {
  constructor(private readonly forwardNavigationAnalyzer = new ForwardNavigationAnalyzer()) {}

  buildReachabilityPlan(journeySteps: StepASTNode[], journeyNode: JourneyASTNode): ReachabilityCompilationPlan {
    const entries = journeySteps.map(stepNode => this.buildReachabilityEntry(stepNode))
    const resumeWhen = journeyNode.properties.reachability?.resumeWhen
    const resumeAlways = resumeWhen === true
    const resumeWhenNode = resumeWhen !== undefined && resumeWhen !== true ? resumeWhen : undefined
    const stateTable: ReachabilityStateTable = {
      entries: entries.map(entry => ({
        stepId: entry.stepId,
        code: entry.code,
        isEntryPoint: entry.isEntryPoint,
        forwardOutcomeEvaluation: entry.forwardOutcomeEvaluation,
      })),
      unreachableRedirect: journeyNode.properties.reachability?.unreachableRedirect ?? 'entry',
      reachabilityDisabled: this.resolveReachabilityDisabled(journeyNode),
    }

    return {
      stateTable,
      entries,
      resumeAlways,
      resumeWhen: resumeWhenNode,
    }
  }

  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityCompilationEntry {
    const stepId = stepNode.id
    const { forwardOutcomeEvaluation, forwardOutcomeGroups } = this.forwardNavigationAnalyzer.analyze(stepNode)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      stepId,
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhen: entryWhen !== undefined && entryWhen !== true ? entryWhen : undefined,
      forwardOutcomeEvaluation,
      forwardOutcomeGroups,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      reachabilityTieBreakers: (reachability?.tieBreakers ?? []).map(entry => ({
        priority: entry.properties.priority,
        when: entry.properties.when,
      })),
    }
  }

  // Walks ancestor journeys inner-first, inheriting the disable flag from the
  // nearest ancestor that sets one.
  private resolveReachabilityDisabled(journeyNode: JourneyASTNode): boolean {
    const ownSetting = journeyNode.properties.reachability?.disableReachabilityChecks

    if (ownSetting !== undefined) {
      return ownSetting
    }

    let current: ASTNode | undefined = journeyNode.parent

    while (current !== undefined) {
      if (current.type === ASTNodeType.JOURNEY) {
        const ancestorSetting = (current as JourneyASTNode).properties.reachability?.disableReachabilityChecks

        if (ancestorSetting !== undefined) {
          return ancestorSetting
        }
      }

      current = current.parent
    }

    return false
  }
}

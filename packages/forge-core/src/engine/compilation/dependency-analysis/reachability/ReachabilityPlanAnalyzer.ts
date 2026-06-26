import type { NodeId } from '../../../contracts/ast/ast.type'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type {
  NavigationRuntimePlan,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
} from '../../../contracts/plans/runtimePlans.type'
import type { FieldInventoryStepSource } from '../../../contracts/plans/compilationPlan.type'
import FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'
import RuntimePlanAnalyzer from '../shared/RuntimePlanAnalyzer'
import ForwardNavigationAnalyzer from './ForwardNavigationAnalyzer'

type JourneyIndex = Map<NodeId, JourneyASTNode>

export default class ReachabilityPlanAnalyzer {
  constructor(
    private readonly fieldInventoryAnalyzer: FieldInventoryAnalyzer,
    private readonly runtimePlanAnalyzer: RuntimePlanAnalyzer,
    private readonly forwardNavigationAnalyzer = new ForwardNavigationAnalyzer(),
  ) {}

  buildReachabilityPlan(
    journeySteps: StepASTNode[],
    journeyNode: JourneyASTNode | undefined,
    journeyIndex: JourneyIndex,
  ): ReachabilityCompilationPlan {
    const entries = journeySteps.map(stepNode => this.buildReachabilityEntry(stepNode))
    const resumeWhen = journeyNode?.properties.reachability?.resumeWhen
    const resumeAlways = resumeWhen === true
    const resumeWhenNodeId = resumeWhen !== undefined && resumeWhen !== true ? resumeWhen.id : undefined
    const navigationPlan: NavigationRuntimePlan = {
      entries: entries.map(entry => ({
        stepId: entry.stepId,
        code: entry.code,
        isEntryPoint: entry.isEntryPoint,
        hasValidation: entry.hasValidation,
        forwardOutcomeEvaluation: entry.forwardOutcomeEvaluation,
      })),
      resumeConfigured: resumeAlways || resumeWhenNodeId !== undefined,
      unreachableRedirect: journeyNode?.properties.reachability?.unreachableRedirect ?? 'entry',
      reachabilityDisabled: this.resolveReachabilityDisabled(journeyNode, journeyIndex),
    }

    return {
      navigationPlan,
      entries,
      resumeAlways,
      resumeWhenNodeId,
    }
  }

  buildFieldInventorySources(plan: ReachabilityCompilationPlan): FieldInventoryStepSource[] {
    return this.fieldInventoryAnalyzer.buildFieldInventorySources(plan)
  }

  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityCompilationEntry {
    const stepId = stepNode.id
    const { forwardOutcomeEvaluation, forwardOutcomeGroups } = this.forwardNavigationAnalyzer.analyze(stepNode)
    const hasValidation =
      this.fieldInventoryAnalyzer.hasValidationBlocks(stepId) ||
      this.fieldInventoryAnalyzer.hasConfiguredValue(stepNode.properties.validWhen)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      stepId,
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhenNodeId: entryWhen !== undefined && entryWhen !== true ? entryWhen.id : undefined,
      forwardOutcomeEvaluation,
      forwardOutcomeGroups,
      hasValidation,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      reachabilityTieBreakers: (reachability?.tieBreakers ?? []).map(entry => ({
        priority: entry.properties.priority,
        whenNodeId: entry.properties.when?.id,
      })),
    }
  }

  private resolveReachabilityDisabled(journeyNode: JourneyASTNode | undefined, journeyIndex: JourneyIndex): boolean {
    if (!journeyNode) {
      return false
    }

    const ownSetting = journeyNode.properties.reachability?.disableReachabilityChecks

    if (ownSetting !== undefined) {
      return ownSetting
    }

    const ancestorJourney = this.runtimePlanAnalyzer.resolveAncestorIds(journeyNode.id)
      .slice(0, -1)
      .reverse()
      .map(ancestorId => journeyIndex.get(ancestorId))
      .find(ancestor => ancestor?.properties.reachability?.disableReachabilityChecks !== undefined)

    return ancestorJourney?.properties.reachability?.disableReachabilityChecks ?? false
  }
}

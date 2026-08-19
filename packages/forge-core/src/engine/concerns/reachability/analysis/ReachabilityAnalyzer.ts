import type { ASTNode } from '../../../chassis/contracts/ast/ast.type'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { JourneyASTNode, StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import type {
  ReachabilityStateTable,
  ReachabilityEntryModel,
  ReachabilityModel,
} from '../contracts/reachabilityModel.type'
import type {
  JourneyAnalysisContext,
  JourneyModelAnalyzer,
} from '../../../chassis/compilation/analysis/concernAnalyzers.type'
import ForwardNavigationAnalyzer from './ForwardNavigationAnalyzer'

export default class ReachabilityAnalyzer implements JourneyModelAnalyzer<ReachabilityModel> {
  private readonly forwardNavigationAnalyzer = new ForwardNavigationAnalyzer()

  analyzeJourney(context: JourneyAnalysisContext): ReachabilityModel {
    const { journeyNode } = context
    const entries = context.stepNodes.map(stepNode => this.buildReachabilityEntry(stepNode))
    const resumeWhen = journeyNode.properties.reachability?.resumeWhen
    const resumeAlways = resumeWhen === true
    const resumeWhenNode = resumeWhen !== undefined && resumeWhen !== true ? resumeWhen : undefined
    const stateTable: ReachabilityStateTable = {
      entries: entries.map(entry => ({
        stepId: entry.stepId,
        code: entry.code,
        isEntryPoint: entry.isEntryPoint,
      })),
      unreachableRedirect: journeyNode.properties.reachability?.unreachableRedirect ?? 'entry',
      reachabilityDisabled: this.resolveReachabilityDisabled(context),
    }

    return {
      label: this.deriveLabel(context, entries, resumeWhenNode),
      stateTable,
      entries,
      resumeAlways,
      resumeWhen: resumeWhenNode,
    }
  }

  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityEntryModel {
    const stepId = stepNode.id
    const { forwardOutcomeGroups } = this.forwardNavigationAnalyzer.analyze(stepNode)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      stepId,
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhen: entryWhen !== undefined && entryWhen !== true ? entryWhen : undefined,
      forwardOutcomeGroups,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      reachabilityTieBreakers: (reachability?.tieBreakers ?? []).map(entry => ({
        priority: entry.properties.priority,
        when: entry.properties.when,
      })),
    }
  }

  // The disable flag inherits from the nearest journey that sets one, starting
  // with the journey itself.
  private resolveReachabilityDisabled(context: JourneyAnalysisContext): boolean {
    return context.ancestry.nearestAncestorSetting(context.journeyNode, ancestor =>
        this.isJourneyNode(ancestor) ? ancestor.properties.reachability?.disableReachabilityChecks : undefined,
      ) ?? false
  }

  // The label is derived from any reachability-related expression nodes (resume
  // conditions, entry conditions, redirect targets). It names the journey
  // segment of the generated function's URL for debugging.
  private deriveLabel(
    context: JourneyAnalysisContext,
    entries: readonly ReachabilityEntryModel[],
    resumeWhen: ASTNode | undefined,
  ): string | undefined {
    const dynamicNodes = [
      resumeWhen,
      ...entries.flatMap(entry => [
        entry.entryWhen,
        ...entry.forwardOutcomeGroups.flatMap(group => group.redirectOutcomes.map(outcome => outcome.node)),
      ]),
    ]

    return context.labels.labelFrom(dynamicNodes, { maxDepth: 1 })
  }

  private isJourneyNode(node: ASTNode): node is JourneyASTNode {
    return node.type === ASTNodeType.JOURNEY
  }
}

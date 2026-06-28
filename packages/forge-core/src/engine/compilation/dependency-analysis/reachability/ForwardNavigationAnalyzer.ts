import type { ASTNode, NodeId } from '../../../contracts/ast/ast.type'
import type { RedirectOutcomeASTNode, SubmitHookASTNode } from '../../../contracts/ast/expressions.type'
import type { StepASTNode } from '../../../contracts/ast/structures.type'
import { isASTNode } from '../../../contracts/ast/nodes'
import { isRedirectOutcomeNode } from '../../../contracts/ast/outcome-nodes'
import type { ForwardOutcomeEvaluation, ForwardOutcomeGroup } from '../../../contracts/plans/runtimePlans.type'
import RequestTimeReferenceAnalyzer from './RequestTimeReferenceAnalyzer'

export interface ForwardNavigationAnalysis {
  readonly forwardOutcomeEvaluation: ForwardOutcomeEvaluation
  readonly forwardOutcomeGroups: ForwardOutcomeGroup[]
}

export default class ForwardNavigationAnalyzer {
  constructor(private readonly requestTimeReferenceAnalyzer = new RequestTimeReferenceAnalyzer()) {}

  analyze(stepNode: StepASTNode): ForwardNavigationAnalysis {
    const submitHooks = stepNode.properties.onSubmission ?? []
    const forwardNavigation = submitHooks
      .map(hook => ({
        forwardOutcomeGroup: this.buildForwardOutcomeGroup(hook),
        overApproximatesForwardNavigation: this.overApproximatesForwardNavigation(hook),
      }))
      .filter(entry => entry.forwardOutcomeGroup.outcomeIds.length > 0)

    return {
      forwardOutcomeEvaluation: forwardNavigation.some(entry => entry.overApproximatesForwardNavigation)
        ? 'over-approximate'
        : 'exact',
      forwardOutcomeGroups: forwardNavigation.map(entry => entry.forwardOutcomeGroup),
    }
  }

  private buildForwardOutcomeGroup(hook: SubmitHookASTNode): ForwardOutcomeGroup {
    const forwardRedirectOutcomes = this.forwardRedirectOutcomes(hook)
    const overApproximateOutcomeIds = forwardRedirectOutcomes
      .filter(outcome => this.overApproximatesOutcomeWhen(outcome.properties.when))
      .map(outcome => outcome.id)

    return {
      hookWhenNodeId: this.resolveReachabilityCompilableHookWhen(hook.properties.when),
      overApproximateOutcomeIds: overApproximateOutcomeIds.length > 0 ? overApproximateOutcomeIds : undefined,
      outcomeIds: forwardRedirectOutcomes.map(node => node.id),
    }
  }

  private resolveReachabilityCompilableHookWhen(when: ASTNode | undefined): NodeId | undefined {
    if (when === undefined || !isASTNode(when)) {
      return undefined
    }

    if (this.requestTimeReferenceAnalyzer.containsRequestTimeReference(when)) {
      return undefined
    }

    return when.id
  }

  private overApproximatesHookWhen(when: ASTNode | undefined): boolean {
    return when !== undefined && isASTNode(when) && this.requestTimeReferenceAnalyzer.containsRequestTimeReference(when)
  }

  private overApproximatesForwardNavigation(hook: SubmitHookASTNode): boolean {
    if (this.overApproximatesHookWhen(hook.properties.when)) {
      return true
    }

    return this.forwardRedirectOutcomes(hook).some(outcome => this.overApproximatesOutcomeWhen(outcome.properties.when))
  }

  private forwardRedirectOutcomes(hook: SubmitHookASTNode): RedirectOutcomeASTNode[] {
    const alwaysOutcomes = (hook.properties.onAlways?.next ?? []).filter(isRedirectOutcomeNode)
    const validOutcomes = hook.properties.validate
      ? (hook.properties.onValid?.next ?? []).filter(isRedirectOutcomeNode)
      : []

    return [...alwaysOutcomes, ...validOutcomes]
  }

  private overApproximatesOutcomeWhen(when: ASTNode | undefined): boolean {
    return when !== undefined && isASTNode(when) && this.requestTimeReferenceAnalyzer.containsRequestTimeReference(when)
  }
}

import type { ASTNode } from '../../../contracts/ast/ast.type'
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
        overApproximatesHookWhen: this.overApproximatesHookWhen(hook.properties.when),
      }))
      .filter(entry => entry.forwardOutcomeGroup.redirectOutcomes.length > 0)

    const overApproximate = forwardNavigation.some(
      entry =>
        entry.overApproximatesHookWhen ||
        entry.forwardOutcomeGroup.redirectOutcomes.some(outcome => outcome.overApproximatesWhen),
    )

    return {
      forwardOutcomeEvaluation: overApproximate ? 'over-approximate' : 'exact',
      forwardOutcomeGroups: forwardNavigation.map(entry => entry.forwardOutcomeGroup),
    }
  }

  private buildForwardOutcomeGroup(hook: SubmitHookASTNode): ForwardOutcomeGroup {
    const redirectOutcomes = this.forwardRedirectOutcomes(hook).map(node => ({
      node,
      overApproximatesWhen: this.overApproximatesOutcomeWhen(node.properties.when),
    }))

    return {
      hookWhen: this.resolveReachabilityCompilableHookWhen(hook.properties.when),
      redirectOutcomes,
    }
  }

  private resolveReachabilityCompilableHookWhen(when: ASTNode | undefined): ASTNode | undefined {
    if (when === undefined || !isASTNode(when)) {
      return undefined
    }

    if (this.requestTimeReferenceAnalyzer.containsRequestTimeReference(when)) {
      return undefined
    }

    return when
  }

  private overApproximatesHookWhen(when: ASTNode | undefined): boolean {
    return when !== undefined && isASTNode(when) && this.requestTimeReferenceAnalyzer.containsRequestTimeReference(when)
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

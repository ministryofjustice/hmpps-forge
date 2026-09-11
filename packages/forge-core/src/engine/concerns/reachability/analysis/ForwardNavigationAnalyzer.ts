import AuthoredValueClassifier from '../../../chassis/compilation/analysis/shared/AuthoredValueClassifier'
import type { AuthoredValue } from '../../../chassis/contracts/models/authoredValue.type'
import type { ASTNode } from '../../../chassis/contracts/ast/ast.type'
import type { RedirectOutcomeASTNode, SubmitHookASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import { isASTNode } from '../../../chassis/contracts/ast/nodes'
import { isRedirectOutcomeNode } from '../../../chassis/contracts/ast/outcome-nodes'
import type { ForwardOutcomeGroup } from '../contracts/reachabilityModel.type'
import RequestTimeReferenceAnalyzer from './RequestTimeReferenceAnalyzer'

export interface ForwardNavigationAnalysis {
  readonly forwardOutcomeGroups: ForwardOutcomeGroup[]
}

export default class ForwardNavigationAnalyzer {
  constructor(
    private readonly requestTimeReferenceAnalyzer = new RequestTimeReferenceAnalyzer(),
    private readonly classifier = new AuthoredValueClassifier(),
  ) {}

  analyze(stepNode: StepASTNode): ForwardNavigationAnalysis {
    const submitHooks = stepNode.properties.onSubmission ?? []

    return {
      forwardOutcomeGroups: submitHooks
        .map(hook => this.buildForwardOutcomeGroup(hook))
        .filter(group => group.redirectOutcomes.length > 0),
    }
  }

  private buildForwardOutcomeGroup(hook: SubmitHookASTNode): ForwardOutcomeGroup {
    const redirectOutcomes = this.forwardRedirectOutcomes(hook).map(node => ({
      source: node,
      when: node.properties.when === undefined ? undefined : this.classifier.classify(node.properties.when),
      goto:
        typeof node.properties.goto === 'string'
          ? node.properties.goto
          : this.classifier.classify(node.properties.goto),
      overApproximatesWhen: this.overApproximatesOutcomeWhen(node.properties.when),
    }))

    return {
      hookWhen: this.resolveReachabilityCompilableHookWhen(hook.properties.when),
      redirectOutcomes,
    }
  }

  private resolveReachabilityCompilableHookWhen(when: ASTNode | undefined): AuthoredValue | undefined {
    if (when === undefined || !isASTNode(when)) {
      return undefined
    }

    if (this.requestTimeReferenceAnalyzer.containsRequestTimeReference(when)) {
      return undefined
    }

    return this.classifier.classify(when)
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

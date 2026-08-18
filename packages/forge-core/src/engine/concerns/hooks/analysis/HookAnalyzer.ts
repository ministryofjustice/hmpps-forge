import { FunctionType } from '../../../../authoring/types/enums'
import type {
  JourneyAnalysisContext,
  JourneyModelAnalyzer,
  StepAnalysisContext,
  StepModelAnalyzer,
} from '../../../chassis/compilation/analysis/concernAnalyzers.type'
import type Ancestry from '../../../chassis/compilation/analysis/shared/Ancestry'
import type AuthoredValueClassifier from '../../../chassis/compilation/analysis/shared/AuthoredValueClassifier'
import type { ASTNode } from '../../../chassis/contracts/ast/ast.type'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type {
  AccessHookASTNode,
  FunctionASTNode,
  RedirectOutcomeASTNode,
  SubmitHookASTNode,
  ThrowErrorOutcomeASTNode,
} from '../../../chassis/contracts/ast/expressions.type'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '../../../chassis/contracts/ast/outcome-nodes'
import type { JourneyASTNode, StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import { expressionValue, type ExpressionValue } from '../../../chassis/contracts/models/authoredValue.type'
import type {
  AccessHookModel,
  AccessLifecycleModel,
  EffectCall,
  HookOutcomeModel,
  JourneyHookModel,
  StepHookModel,
  SubmitBranchModel,
  SubmitHookModel,
} from '../contracts/hookModel.type'
import { HookOutcomeKind } from '../contracts/hookModel.type'

type SubmitBranchAST = { effects?: ASTNode[]; next?: ASTNode[] } | undefined

export default class HookAnalyzer implements StepModelAnalyzer<StepHookModel>, JourneyModelAnalyzer<JourneyHookModel> {
  analyzeStep(context: StepAnalysisContext): StepHookModel {
    const { stepNode, labels } = context
    const accessHookNodes = this.resolveAccessHooks(stepNode, context.ancestry)
    const submitHookNodes = stepNode.properties.onSubmission ?? []

    return {
      access: this.buildAccessLifecycle(
        accessHookNodes,
        labels.labelFrom([stepNode, ...accessHookNodes]),
        context.classifier,
      ),
      submit: {
        label: labels.labelFrom([stepNode, ...submitHookNodes]),
        hooks: submitHookNodes.map((hook, hookIndex) => this.buildSubmitHook(hook, hookIndex, context.classifier)),
      },
    }
  }

  analyzeJourney(context: JourneyAnalysisContext): JourneyHookModel {
    const accessHookNodes = this.resolveAccessHooks(context.journeyNode, context.ancestry)

    return {
      access: this.buildAccessLifecycle(accessHookNodes, context.labels.labelFrom(accessHookNodes), context.classifier),
    }
  }

  private buildAccessLifecycle(
    hookNodes: readonly AccessHookASTNode[],
    label: string | undefined,
    classifier: AuthoredValueClassifier,
  ): AccessLifecycleModel {
    return {
      label,
      hooks: hookNodes.map((hook, hookIndex) => this.buildAccessHook(hook, hookIndex, classifier)),
    }
  }

  // Access hooks flatten root-first, so an outer journey's hooks run before an inner node's.
  private resolveAccessHooks(node: JourneyASTNode | StepASTNode, ancestry: Ancestry): AccessHookASTNode[] {
    return ancestry
      .valuesRootFirst<AccessHookASTNode[]>(node, ancestor =>
        this.isAccessAncestor(ancestor) ? ancestor.properties.onAccess : undefined,
      )
      .flat()
  }

  private buildAccessHook(
    hook: AccessHookASTNode,
    hookIndex: number,
    classifier: AuthoredValueClassifier,
  ): AccessHookModel {
    const key = `access-hook-${hookIndex}`

    return {
      key,
      label: this.describeHookNode(hook, key),
      when: this.classifyExpression(hook.properties.when),
      effects: this.classifyEffects(hook.properties.effects, key, classifier),
      outcomes: this.classifyOutcomes(hook.properties.next),
    }
  }

  private buildSubmitHook(
    hook: SubmitHookASTNode,
    hookIndex: number,
    classifier: AuthoredValueClassifier,
  ): SubmitHookModel {
    const key = `submit-hook-${hookIndex}`
    const validationGroups = hook.properties.validationGroups ?? []

    return {
      key,
      label: this.describeHookNode(hook, key),
      when: this.classifyExpression(hook.properties.when),
      guards: this.classifyExpression(hook.properties.guards),
      validate: hook.properties.validate,
      validationGroups: validationGroups.length > 0 ? validationGroups : ['default'],
      branches: {
        // Even if the author didn't write an `onAlways` branch, we still compile an empty one.
        onAlways: this.buildSubmitBranch(hook.properties.onAlways, `${key}-onAlways`, classifier),
        onValid:
          hook.properties.onValid !== undefined
            ? this.buildSubmitBranch(hook.properties.onValid, `${key}-onValid`, classifier)
            : undefined,
        onInvalid:
          hook.properties.onInvalid !== undefined
            ? this.buildSubmitBranch(hook.properties.onInvalid, `${key}-onInvalid`, classifier)
            : undefined,
      },
    }
  }

  private buildSubmitBranch(
    branch: SubmitBranchAST,
    branchKey: string,
    classifier: AuthoredValueClassifier,
  ): SubmitBranchModel {
    return {
      effects: this.classifyEffects(branch?.effects, branchKey, classifier),
      outcomes: this.classifyOutcomes(branch?.next),
    }
  }

  private classifyEffects(
    effects: ASTNode[] | undefined,
    keyPrefix: string,
    classifier: AuthoredValueClassifier,
  ): EffectCall[] {
    return (effects ?? [])
      .filter(node => this.isEffectNode(node))
      .map((effect, effectIndex) => ({
        key: `${keyPrefix}-effect-${effectIndex}`,
        name: effect.properties.name,
        arguments: (effect.properties.arguments ?? []).map(argument => classifier.classify(argument)),
        node: expressionValue(effect),
      }))
  }

  private classifyOutcomes(next: ASTNode[] | undefined): HookOutcomeModel[] {
    return (next ?? [])
      .filter(node => this.isOutcomeNode(node))
      .map(outcomeNode =>
        isRedirectOutcomeNode(outcomeNode)
          ? this.classifyRedirectOutcome(outcomeNode)
          : this.classifyThrowErrorOutcome(outcomeNode),
      )
  }

  private classifyRedirectOutcome(redirect: RedirectOutcomeASTNode): HookOutcomeModel {
    const { goto } = redirect.properties

    return {
      kind: HookOutcomeKind.REDIRECT,
      when: this.classifyExpression(redirect.properties.when),
      goto: typeof goto === 'string' ? goto : expressionValue(goto),
    }
  }

  private classifyThrowErrorOutcome(errorOutcome: ThrowErrorOutcomeASTNode): HookOutcomeModel {
    const { message } = errorOutcome.properties

    return {
      kind: HookOutcomeKind.THROW_ERROR,
      when: this.classifyExpression(errorOutcome.properties.when),
      status: errorOutcome.properties.status,
      message: typeof message === 'string' ? message : expressionValue(message),
    }
  }

  private classifyExpression(node: ASTNode | undefined): ExpressionValue | undefined {
    return node === undefined ? undefined : expressionValue(node)
  }

  private describeHookNode(hook: AccessHookASTNode | SubmitHookASTNode, hookKey: string): string {
    return hook.diagnostics?.source.formattedPath ?? hookKey
  }

  private isAccessAncestor(node: ASTNode): node is JourneyASTNode | StepASTNode {
    return node.type === ASTNodeType.JOURNEY || node.type === ASTNodeType.STEP
  }

  private isEffectNode(node: ASTNode): node is FunctionASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      (node as { expressionType?: unknown }).expressionType === FunctionType.EFFECT
  }

  private isOutcomeNode(node: ASTNode): node is RedirectOutcomeASTNode | ThrowErrorOutcomeASTNode {
    return isRedirectOutcomeNode(node) || isThrowErrorOutcomeNode(node)
  }
}

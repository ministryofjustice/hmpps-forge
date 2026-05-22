import { normalizeRelativePath } from '../../framework/path/routePath'
import { ASTNode, NodeId } from '../types/ast.type'
import { SubmitHookASTNode } from '../types/expressions.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { isRedirectOutcomeNode } from '../typeguards/outcome-nodes'
import getAncestorChain from '../utils/getAncestorChain'
import ASTNodeTree from './node-tree/ASTNodeTree'
import NodeRegistry from './registries/NodeRegistry'
import { BlockType } from '../../authoring/types/enums'
import { ASTNodeType } from '../types/enums'
import type {
  JourneyRuntimePlan,
  NavigationRuntimePlan,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
  StepRuntimePlan,
} from '../types/runtimePlans.type'

export interface ReachabilityTieBreakerEntry {
  priority: number
  whenNodeId?: NodeId
}

/**
 * Builds the small immutable plan objects consumed by controllers and compilers.
 */
export default class RuntimePlanBuilder {
  private readonly allFieldBlocks: FieldBlockASTNode[]

  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly astNodeTree: ASTNodeTree,
  ) {
    this.allFieldBlocks = nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
  }

  /**
   * Build step, navigation, reachability compilation, and journey runtime plans.
   *
   * Groups steps by parent journey. For each journey that owns direct steps,
   * builds one `ReachabilityCompilationPlan`, one `NavigationRuntimePlan`, and one `JourneyRuntimePlan`.
   * The navigation map is step-keyed for fast lookup, but all direct steps in
   * the same journey share the same plan instance.
   */
  buildAllPlans(
    stepIndex: Map<NodeId, StepASTNode>,
    journeyIndex: Map<NodeId, JourneyASTNode>,
  ): {
    stepRuntimePlans: Map<NodeId, StepRuntimePlan>
    navigationPlansByStepId: Map<NodeId, NavigationRuntimePlan>
    reachabilityCompilationPlans: ReachabilityCompilationPlan[]
    journeyRuntimePlans: Map<NodeId, JourneyRuntimePlan>
  } {
    const journeyStepMap = new Map<NodeId, StepASTNode[]>()
    const stepRuntimePlans = new Map<NodeId, StepRuntimePlan>()
    const navigationPlansByStepId = new Map<NodeId, NavigationRuntimePlan>()
    const reachabilityCompilationPlans: ReachabilityCompilationPlan[] = []
    const journeyRuntimePlans = new Map<NodeId, JourneyRuntimePlan>()

    stepIndex.forEach((stepNode, stepId) => {
      stepRuntimePlans.set(stepId, this.buildStepRuntimePlan(stepNode))

      const ancestors = getAncestorChain(stepId, this.astNodeTree)
      const parentJourneyId = ancestors[ancestors.length - 2]

      if (parentJourneyId) {
        const existingJourneySteps = journeyStepMap.get(parentJourneyId) ?? []

        existingJourneySteps.push(stepNode)
        journeyStepMap.set(parentJourneyId, existingJourneySteps)
      }
    })

    journeyStepMap.forEach((journeySteps, journeyId) => {
      const journeyNode = journeyIndex.get(journeyId)
      const reachabilityCompilationPlan = this.buildReachabilityPlan(journeySteps, journeyNode, journeyIndex)

      journeySteps.forEach(stepNode => {
        navigationPlansByStepId.set(stepNode.id, reachabilityCompilationPlan.navigationPlan)
      })

      reachabilityCompilationPlans.push(reachabilityCompilationPlan)

      if (journeyNode) {
        journeyRuntimePlans.set(
          journeyId,
          this.buildJourneyRuntimePlan(journeyNode, reachabilityCompilationPlan.navigationPlan),
        )
      }
    })

    return { stepRuntimePlans, navigationPlansByStepId, reachabilityCompilationPlans, journeyRuntimePlans }
  }

  private buildJourneyRuntimePlan(
    journeyNode: JourneyASTNode,
    navigationPlan: NavigationRuntimePlan,
  ): JourneyRuntimePlan {
    return {
      path: normalizeRelativePath(journeyNode.properties.path),
      staticData: this.buildStaticData(getAncestorChain(journeyNode.id, this.astNodeTree)),
      navigationPlan,
    }
  }

  private buildReachabilityPlan(
    journeySteps: StepASTNode[],
    journeyNode: JourneyASTNode | undefined,
    journeyIndex: Map<NodeId, JourneyASTNode>,
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
      })),
      resumeConfigured: resumeAlways || resumeWhenNodeId !== undefined,
      unreachableRedirect: journeyNode?.properties.reachability?.unreachableRedirect ?? 'entry',
      reachabilityDisabled: this.resolveReachabilityDisabled(journeyNode, journeyIndex),
      compiledStepValidations: new Map(),
    }

    return {
      navigationPlan,
      entries,
      resumeAlways,
      resumeWhenNodeId,
    }
  }

  /**
   * Resolves inherited reachability disabling from the nearest journey setting.
   *
   * A journey's own setting wins first; otherwise the nearest ancestor journey
   * with an explicit setting controls the direct-step navigation plan.
   */
  private resolveReachabilityDisabled(
    journeyNode: JourneyASTNode | undefined,
    journeyIndex: Map<NodeId, JourneyASTNode>,
  ): boolean {
    if (!journeyNode) {
      return false
    }

    const ownSetting = journeyNode.properties.reachability?.disableReachabilityChecks

    if (ownSetting !== undefined) {
      return ownSetting
    }

    const ancestors = getAncestorChain(journeyNode.id, this.astNodeTree)

    for (let i = ancestors.length - 2; i >= 0; i--) {
      const ancestorJourney = journeyIndex.get(ancestors[i])

      if (!ancestorJourney) {
        continue
      }

      const ancestorSetting = ancestorJourney.properties.reachability?.disableReachabilityChecks

      if (ancestorSetting !== undefined) {
        return ancestorSetting
      }
    }

    return false
  }

  /**
   * Extracts reachability inputs that depend on AST node identities.
   */
  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityCompilationEntry {
    const stepId = stepNode.id
    const { forwardOutcomeIds } = this.extractForwardNavigation(stepNode)
    const hasValidation = this.hasValidationBlocks(stepId) || hasConfiguredValue(stepNode.properties.validWhen)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      stepId,
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhenNodeId: entryWhen !== undefined && entryWhen !== true ? entryWhen.id : undefined,
      forwardOutcomeIds,
      hasValidation,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      reachabilityTieBreakers: (reachability?.tieBreakers ?? []).map(entry => ({
        priority: entry.properties.priority,
        whenNodeId: entry.properties.when?.id,
      })),
    }
  }

  /**
   * Builds the plan for one step route.
   */
  buildStepRuntimePlan(stepNode: StepASTNode): StepRuntimePlan {
    const stepId = stepNode.id

    return {
      stepId,
      path: normalizeRelativePath(stepNode.properties.path),
      staticData: this.buildStaticData(getAncestorChain(stepId, this.astNodeTree)),
    }
  }

  /**
   * Merges static `data` from outer to inner ancestors.
   */
  private buildStaticData(ancestorIds: NodeId[]): Record<string, unknown> {
    return (
      ancestorIds
        .map(nodeId => this.getStaticDataNode(nodeId)).reduce<Record<string, unknown>>((data, node) => {
          const staticData = node.properties.data

          if (staticData === undefined) {
            return data
          }

          return { ...data, ...staticData }
        }, {})
    )
  }

  private getStaticDataNode(nodeId: NodeId): JourneyASTNode | StepASTNode {
    const node = this.nodeRegistry.get(nodeId)

    if (!this.isStaticDataNode(node)) {
      throw new Error(`Static data ancestor "${nodeId}" was not registered as a journey or step`)
    }

    return node
  }

  private isStaticDataNode(node: ASTNode | undefined): node is JourneyASTNode | StepASTNode {
    return node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP
  }

  private hasValidationBlocks(stepId: NodeId): boolean {
    return this.allFieldBlocks
      .filter(block => this.astNodeTree.isDescendantOf(block.id, stepId))
      .some(block => hasConfiguredValue(block.properties.validWhen))
  }

  private extractForwardNavigation(stepNode: StepASTNode): {
    forwardOutcomeIds: NodeId[]
  } {
    const submitHooks = stepNode.properties.onSubmission ?? []
    const alwaysOutcomeIds = this.extractOutcomeIdsFromAlwaysBranch(submitHooks)
    const validatingHooks = submitHooks.filter(t => t.properties.validate)
    const validOutcomeIds = validatingHooks.length > 0 ? this.extractOutcomeIdsFromValidBranch(validatingHooks) : []

    return {
      forwardOutcomeIds: [...alwaysOutcomeIds, ...validOutcomeIds],
    }
  }

  private extractOutcomeIdsFromValidBranch(hooks: SubmitHookASTNode[]): NodeId[] {
    return hooks.flatMap(hook =>
      (hook.properties.onValid?.next ?? [])
        .filter(isRedirectOutcomeNode)
        .map(node => node.id),
    )
  }

  private extractOutcomeIdsFromAlwaysBranch(hooks: SubmitHookASTNode[]): NodeId[] {
    return hooks.flatMap(hook =>
      (hook.properties.onAlways?.next ?? [])
        .filter(isRedirectOutcomeNode)
        .map(node => node.id),
    )
  }
}

function hasConfiguredValue(value: unknown): boolean {
  if (value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}

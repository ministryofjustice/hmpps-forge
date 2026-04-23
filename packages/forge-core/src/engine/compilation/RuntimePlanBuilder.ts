import { normalizeRelativePath } from '../../framework/path/routePath'
import { NodeId } from '../types/ast.type'
import type { CompiledAnswerPreparationFunction } from './answer-preparation/StepAnswerPreparationCompiler'
import type { CompiledFieldInventoryFunction } from './field-inventory/StepFieldInventoryCompiler'
import type {
  CompiledAccessLifecycleFunction,
  CompiledActionHooksFunction,
  CompiledSubmitHooksFunction,
} from './hooks/HookLifecycleCompiler'
import type { CompiledReachabilityFunction } from './reachability/ReachabilityCompiler'
import type { CompiledValidationFunction } from './validation/StepValidationCompiler'
import { IterateASTNode, SubmitHookASTNode } from '../types/expressions.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { isRedirectOutcomeNode } from '../typeguards/outcome-nodes'
import getAncestorChain from '../utils/getAncestorChain'
import ASTNodeTree from './node-tree/ASTNodeTree'
import NodeRegistry from './registries/NodeRegistry'
import { BlockType, ExpressionType, IteratorType } from '../../authoring/types/enums'

export interface StepRuntimePlan {
  stepId: NodeId
  path: string
  code?: string
  accessAncestorIds: NodeId[]
  actionHookIds: NodeId[]
  submitHookIds: NodeId[]
  iterateNodeIds: NodeId[]
  validationBlockIds: NodeId[]
  domainValidationNodeIds: NodeId[]
  renderAncestorIds: NodeId[]
  renderStepId: NodeId
  hasValidatingSubmitHook: boolean
  hasDomainValidation: boolean
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
  compiledActionHooks?: CompiledActionHooksFunction
  compiledSubmitHooks?: CompiledSubmitHooksFunction
}

export interface ReachabilityRuntimePlan {
  entries: ReachabilityStepEntry[]
  resumeAlways: boolean
  resumeWhenNodeId?: NodeId
  reachabilityDisabled: boolean
  /**
   * Generated function that pre-computes entry predicates, forward outcomes,
   * tie-breaker priorities, and the resume condition in a single call.
   *
   * The plan is shared across every direct step in a journey, so this function is
   * compiled once and reused for GET, POST, and journey-root navigation checks.
   */
  compiledReachability?: CompiledReachabilityFunction
  compiledFieldInventory?: CompiledFieldInventoryFunction
  resolveStepValidations?: () => Map<NodeId, CompiledValidationFunction>
}

export interface ReachabilityStepEntry {
  stepId: NodeId
  path: string
  code?: string
  isEntryPoint: boolean
  entryWhenNodeId?: NodeId
  forwardOutcomeIds: NodeId[]
  hasValidation: boolean
  cleardownFieldCodes: string[]
  iterateNodeIds: NodeId[]
  validationBlockIds: NodeId[]
  domainValidationNodeIds: NodeId[]
  reachabilityTieBreakers: ReachabilityTieBreakerEntry[]
}

/**
 * Runtime shape of a tie-breaker rule. `whenNodeId` points to the predicate
 * expression compiled into the reachability quick function; when absent, the
 * rule is a catch-all.
 */
export interface ReachabilityTieBreakerEntry {
  priority: number
  whenNodeId?: NodeId
}

/**
 * Runtime plan for a journey as a whole, used when handling the journey root
 * (for example resume). It carries the journey access chain, the MAP iterator
 * nodes for its direct steps, and the shared reachability plan for those steps.
 */
export interface JourneyRuntimePlan {
  journeyId: NodeId
  path: string
  accessAncestorIds: NodeId[]
  iterateNodeIds: NodeId[]
  reachabilityPlan: ReachabilityRuntimePlan
  /**
   * Compiled answer preparation for the journey root. This covers the journey's
   * direct steps so resume/reachability can evaluate with prepared answers
   * without pretending that a specific step is currently being rendered.
   */
  compiledAnswerPreparation?: CompiledAnswerPreparationFunction
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
}

/**
 * Builds the small immutable plan objects consumed by controllers and compilers.
 *
 * Plans deliberately store node IDs and topology, not generated source. Compilers
 * later use those IDs to pull AST nodes from the shared registry and attach the
 * generated functions back onto the same plan objects.
 */
export default class RuntimePlanBuilder {
  private readonly allIterateNodes: IterateASTNode[]

  private readonly allFieldBlocks: FieldBlockASTNode[]

  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly astNodeTree: ASTNodeTree,
  ) {
    this.allIterateNodes = nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
    this.allFieldBlocks = nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
  }

  /**
   * Build reachability and journey runtime plans in a single pass.
   *
   * Groups steps by parent journey. For each journey that owns direct steps,
   * builds one `ReachabilityRuntimePlan` and one `JourneyRuntimePlan`.
   * The reachability map is step-keyed for fast lookup, but all direct steps in
   * the same journey share the same plan instance.
   */
  buildAllPlans(
    stepIndex: Map<NodeId, StepASTNode>,
    journeyIndex: Map<NodeId, JourneyASTNode>,
  ): {
    reachabilityPlansByStepId: Map<NodeId, ReachabilityRuntimePlan>
    journeyRuntimePlans: Map<NodeId, JourneyRuntimePlan>
  } {
    const journeyStepMap = new Map<NodeId, StepASTNode[]>()
    const reachabilityPlansByStepId = new Map<NodeId, ReachabilityRuntimePlan>()
    const journeyRuntimePlans = new Map<NodeId, JourneyRuntimePlan>()

    stepIndex.forEach((stepNode, stepId) => {
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
      const reachabilityPlan = this.buildReachabilityPlan(journeySteps, journeyNode, journeyIndex)

      journeySteps.forEach(stepNode => {
        reachabilityPlansByStepId.set(stepNode.id, reachabilityPlan)
      })

      if (journeyNode) {
        journeyRuntimePlans.set(journeyId, this.buildJourneyRuntimePlan(journeyNode, reachabilityPlan))
      }
    })

    return { reachabilityPlansByStepId, journeyRuntimePlans }
  }

  private buildJourneyRuntimePlan(
    journeyNode: JourneyASTNode,
    reachabilityPlan: ReachabilityRuntimePlan,
  ): JourneyRuntimePlan {
    return {
      journeyId: journeyNode.id,
      path: normalizeRelativePath(journeyNode.properties.path),
      accessAncestorIds: getAncestorChain(journeyNode.id, this.astNodeTree),
      iterateNodeIds: reachabilityPlan.entries.flatMap(entry => entry.iterateNodeIds),
      reachabilityPlan,
    }
  }

  private buildReachabilityPlan(
    journeySteps: StepASTNode[],
    journeyNode: JourneyASTNode | undefined,
    journeyIndex: Map<NodeId, JourneyASTNode>,
  ): ReachabilityRuntimePlan {
    const entries = journeySteps.map(stepNode => this.buildReachabilityEntry(stepNode))
    const resumeWhen = journeyNode?.properties.reachability?.resumeWhen

    return {
      entries,
      resumeAlways: resumeWhen === true,
      resumeWhenNodeId: resumeWhen !== undefined && resumeWhen !== true ? resumeWhen.id : undefined,
      reachabilityDisabled: this.resolveReachabilityDisabled(journeyNode, journeyIndex),
    }
  }

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

  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityStepEntry {
    const stepId = stepNode.id
    const { forwardOutcomeIds } = this.extractForwardNavigation(stepNode)
    const iterateNodeIds = this.findIterateNodeIds(stepId)
    const validationBlockIds = this.findValidationBlockIds(stepId)
    const domainValidationNodeIds = this.findDomainValidationNodeIds(stepNode)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      stepId,
      path: normalizeRelativePath(stepNode.properties.path),
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhenNodeId: entryWhen !== undefined && entryWhen !== true ? entryWhen.id : undefined,
      forwardOutcomeIds,
      hasValidation: validationBlockIds.length > 0 || domainValidationNodeIds.length > 0,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      iterateNodeIds,
      validationBlockIds,
      domainValidationNodeIds,
      reachabilityTieBreakers: (reachability?.tieBreakers ?? []).map(entry => ({
        priority: entry.properties.priority,
        whenNodeId: entry.properties.when?.id,
      })),
    }
  }

  buildStepRuntimePlan(stepNode: StepASTNode): StepRuntimePlan {
    const stepId = stepNode.id

    const accessAncestorIds = getAncestorChain(stepId, this.astNodeTree)
    const actionHookIds = (stepNode.properties.onAction ?? []).map(hook => hook.id)
    const submitHookIds = (stepNode.properties.onSubmission ?? []).map(hook => hook.id)
    const iterateNodeIds = this.findIterateNodeIds(stepId)
    const validationBlockIds = this.findValidationBlockIds(stepId)
    const domainValidationNodeIds = this.findDomainValidationNodeIds(stepNode)
    const renderAncestorIds = accessAncestorIds.slice(0, -1)

    return {
      stepId,
      path: normalizeRelativePath(stepNode.properties.path),
      code: stepNode.properties.code,
      accessAncestorIds,
      actionHookIds,
      submitHookIds,
      iterateNodeIds,
      validationBlockIds,
      domainValidationNodeIds,
      renderAncestorIds,
      renderStepId: stepId,
      hasValidatingSubmitHook: this.computeHasValidatingSubmitHook(stepNode),
      hasDomainValidation: domainValidationNodeIds.length > 0,
    }
  }

  private findIterateNodeIds(stepId: NodeId): NodeId[] {
    return this.allIterateNodes
      .filter(node => this.astNodeTree.isDescendantOf(node.id, stepId))
      .filter(node => node.properties.iterator.type === IteratorType.MAP)
      .map(node => node.id)
  }

  private findValidationBlockIds(stepId: NodeId): NodeId[] {
    return this.allFieldBlocks
      .filter(block => this.astNodeTree.isDescendantOf(block.id, stepId))
      .filter(block => Array.isArray(block.properties.validWhen) && block.properties.validWhen.length > 0)
      .map(block => block.id)
  }

  private findDomainValidationNodeIds(stepNode: StepASTNode): NodeId[] {
    return (stepNode.properties.validWhen ?? []).map(node => node.id)
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

  private computeHasValidatingSubmitHook(stepNode: StepASTNode): boolean {
    return (stepNode.properties.onSubmission ?? []).some((hook: SubmitHookASTNode) => hook.properties.validate)
  }
}

import ValidationTemplateAnalyzer from './analyzers/ValidationTemplateAnalyzer'
import { normalizeRelativePath } from '../../framework/path/routePath'
import { NodeId } from '../types/ast.type'
import { IterateASTNode, SubmitHookASTNode } from '../types/expressions.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { isRedirectOutcomeNode } from '../typeguards/outcome-nodes'
import getAncestorChain from '../utils/getAncestorChain'
import ASTNodeTree from './node-tree/ASTNodeTree'
import MetadataRegistry from './registries/MetadataRegistry'
import NodeRegistry from './registries/NodeRegistry'
import { BlockType, ExpressionType } from '../../authoring/types/enums'

// ── Step runtime plan ───────────────────────────────────────────────

export interface StepRuntimePlan {
  stepId: NodeId
  path: string
  code?: string
  accessAncestorIds: NodeId[]
  actionHookIds: NodeId[]
  submitHookIds: NodeId[]
  fieldIteratorRootIds: NodeId[]
  validationIterateNodeIds: NodeId[]
  validationBlockIds: NodeId[]
  domainValidationNodeIds: NodeId[]
  renderAncestorIds: NodeId[]
  renderStepId: NodeId
  hasValidatingSubmitHook: boolean
  hasDomainValidation: boolean
}

// ── Reachability runtime plan ───────────────────────────────────────

export interface ReachabilityRuntimePlan {
  entries: ReachabilityStepEntry[]
  resumeAlways: boolean
  resumeWhenNodeId?: NodeId
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
  fieldIteratorRootIds: NodeId[]
  validationIterateNodeIds: NodeId[]
  validationBlockIds: NodeId[]
  domainValidationNodeIds: NodeId[]
  reachabilityTieBreakers: ReachabilityTieBreakerEntry[]
}

/**
 * Runtime shape of a tie-breaker rule. `whenNodeId` is the compiled
 * predicate thunk; when absent, the rule is a catch-all.
 */
export interface ReachabilityTieBreakerEntry {
  priority: number
  whenNodeId?: NodeId
}

// ── Journey runtime plan ────────────────────────────────────────────

/**
 * Runtime plan for a journey as a whole, used when handling the journey root
 * (e.g. resume). Bundles the journey's access ancestor chain, the field
 * iterator roots across every direct step (so answers can be prepared before
 * reachability runs), and the reachability plan shared by the journey's steps.
 */
export interface JourneyRuntimePlan {
  journeyId: NodeId
  path: string
  accessAncestorIds: NodeId[]
  fieldIteratorRootIds: NodeId[]
  reachabilityPlan: ReachabilityRuntimePlan
}

// ── Builder ─────────────────────────────────────────────────────────

/**
 * RuntimePlanBuilder - Builds both step runtime plans and reachability plans
 *
 * Constructed once from the shared compilation and reused for all steps.
 * The node-finding logic (field iterators, validation blocks, etc.) is shared
 * between both plan types and operates on the shared AST via ASTNodeTree.
 *
 * - Reachability plans are built during shared compilation for all steps at once.
 * - Step runtime plans are built per-step during lazy compilation.
 */
export default class RuntimePlanBuilder {
  private readonly allIterateNodes: IterateASTNode[]

  private readonly allFieldBlocks: FieldBlockASTNode[]

  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly metadataRegistry: MetadataRegistry,
    private readonly astNodeTree: ASTNodeTree,
  ) {
    this.allIterateNodes = nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
    this.allFieldBlocks = nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
  }

  /**
   * Build reachability and journey runtime plans in a single pass.
   *
   * Groups steps by parent journey. For each journey that owns direct steps,
   * builds one immutable `ReachabilityRuntimePlan` (with resume config baked
   * in) and one `JourneyRuntimePlan`. Returns both as step-keyed and
   * journey-keyed maps respectively.
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
      const ancestors = getAncestorChain(stepId, this.metadataRegistry)
      const parentJourneyId = ancestors[ancestors.length - 2]

      if (parentJourneyId) {
        const existingJourneySteps = journeyStepMap.get(parentJourneyId) ?? []

        existingJourneySteps.push(stepNode)
        journeyStepMap.set(parentJourneyId, existingJourneySteps)
      }
    })

    journeyStepMap.forEach((journeySteps, journeyId) => {
      const journeyNode = journeyIndex.get(journeyId)
      const reachabilityPlan = this.buildReachabilityPlan(journeySteps, journeyNode)

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
      accessAncestorIds: getAncestorChain(journeyNode.id, this.metadataRegistry),
      fieldIteratorRootIds: reachabilityPlan.entries.flatMap(entry => entry.fieldIteratorRootIds),
      reachabilityPlan,
    }
  }

  private buildReachabilityPlan(
    journeySteps: StepASTNode[],
    journeyNode: JourneyASTNode | undefined,
  ): ReachabilityRuntimePlan {
    const entries = journeySteps.map(stepNode => this.buildReachabilityEntry(stepNode))
    const resumeWhen = journeyNode?.properties.reachability?.resumeWhen

    return {
      entries,
      resumeAlways: resumeWhen === true,
      resumeWhenNodeId: resumeWhen !== undefined && resumeWhen !== true ? resumeWhen.id : undefined,
    }
  }

  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityStepEntry {
    const stepId = stepNode.id
    const { forwardOutcomeIds, hasValidation } = this.extractForwardNavigation(stepNode)
    const fieldIterateNodeIds = this.findFieldIterateNodeIds(stepId)
    const fieldIteratorRootIds = this.findIteratorRootIds(stepId, fieldIterateNodeIds)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      stepId,
      path: normalizeRelativePath(stepNode.properties.path),
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhenNodeId: entryWhen !== undefined && entryWhen !== true ? entryWhen.id : undefined,
      forwardOutcomeIds,
      hasValidation,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      fieldIteratorRootIds,
      validationIterateNodeIds: this.findValidationIterateNodeIds(fieldIterateNodeIds),
      validationBlockIds: this.findValidationBlockIds(stepId),
      domainValidationNodeIds: this.findDomainValidationNodeIds(stepNode),
      reachabilityTieBreakers: (reachability?.tieBreakers ?? []).map(entry => ({
        priority: entry.properties.priority,
        whenNodeId: entry.properties.when?.id,
      })),
    }
  }

  /**
   * Build a step runtime plan for a single step.
   */
  buildStepRuntimePlan(stepNode: StepASTNode): StepRuntimePlan {
    const stepId = stepNode.id

    const accessAncestorIds = getAncestorChain(stepId, this.metadataRegistry)
    const actionHookIds = (stepNode.properties.onAction ?? []).map(hook => hook.id)
    const submitHookIds = (stepNode.properties.onSubmission ?? []).map(hook => hook.id)
    const fieldIterateNodeIds = this.findFieldIterateNodeIds(stepId)
    const fieldIteratorRootIds = this.findIteratorRootIds(stepId, fieldIterateNodeIds)
    const validationIterateNodeIds = this.findValidationIterateNodeIds(fieldIterateNodeIds)
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
      fieldIteratorRootIds,
      validationIterateNodeIds,
      validationBlockIds,
      domainValidationNodeIds,
      renderAncestorIds,
      renderStepId: stepId,
      hasValidatingSubmitHook: this.computeHasValidatingSubmitHook(stepNode),
      hasDomainValidation: domainValidationNodeIds.length > 0,
    }
  }

  // ── Shared node-finding helpers ─────────────────────────────────

  private findFieldIterateNodeIds(stepId: NodeId): NodeId[] {
    return this.allIterateNodes
      .filter(node => this.isDescendantOf(node.id, stepId))
      .filter(node => ValidationTemplateAnalyzer.mayYieldFields(node.properties.iterator.yieldTemplate))
      .map(node => node.id)
  }

  private findIteratorRootIds(stepId: NodeId, iterateNodeIds: NodeId[]): NodeId[] {
    const rootIds = new Set<NodeId>()

    iterateNodeIds.forEach(nodeId => {
      const rootId = this.findTopmostAncestorUnderStep(stepId, nodeId)

      if (rootId) {
        rootIds.add(rootId)
      }
    })

    return [...rootIds]
  }

  private findValidationIterateNodeIds(fieldIterateNodeIds: NodeId[]): NodeId[] {
    const fieldIterateSet = new Set(fieldIterateNodeIds)

    return this.allIterateNodes
      .filter(node => fieldIterateSet.has(node.id))
      .filter(node => ValidationTemplateAnalyzer.mayYieldValidatingFields(node.properties.iterator.yieldTemplate))
      .map(node => node.id)
  }

  private findValidationBlockIds(stepId: NodeId): NodeId[] {
    return this.allFieldBlocks
      .filter(block => this.isDescendantOf(block.id, stepId))
      .filter(block => Array.isArray(block.properties.validWhen) && block.properties.validWhen.length > 0)
      .map(block => block.id)
  }

  private findDomainValidationNodeIds(stepNode: StepASTNode): NodeId[] {
    return (stepNode.properties.validWhen ?? []).map(node => node.id)
  }

  private isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
    let currentId: NodeId | undefined = this.astNodeTree.getParent(nodeId)

    while (currentId !== undefined) {
      if (currentId === ancestorId) {
        return true
      }

      currentId = this.astNodeTree.getParent(currentId)
    }

    return false
  }

  private findTopmostAncestorUnderStep(stepId: NodeId, nodeId: NodeId): NodeId | undefined {
    let currentId: NodeId | undefined = nodeId
    let topmostId: NodeId | undefined

    while (currentId !== undefined) {
      const parentId = this.astNodeTree.getParent(currentId)

      if (parentId === undefined) {
        break
      }

      if (parentId === stepId) {
        topmostId = currentId
        break
      }

      topmostId = currentId
      currentId = parentId
    }

    return topmostId
  }

  // ── Forward navigation extraction ──────────────────────────────

  private extractForwardNavigation(stepNode: StepASTNode): {
    forwardOutcomeIds: NodeId[]
    hasValidation: boolean
  } {
    const submitHooks = stepNode.properties.onSubmission ?? []
    const validatingHooks = submitHooks.filter(t => t.properties.validate === true)

    if (validatingHooks.length > 0) {
      return {
        forwardOutcomeIds: this.extractOutcomeIdsFromValidBranch(validatingHooks),
        hasValidation: true,
      }
    }

    return {
      forwardOutcomeIds: this.extractOutcomeIdsFromAlwaysBranch(submitHooks),
      hasValidation: false,
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
    return (stepNode.properties.onSubmission ?? []).some((hook: SubmitHookASTNode) => hook.properties.validate === true)
  }
}

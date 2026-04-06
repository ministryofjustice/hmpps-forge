import { CompilationDependencies } from './CompilationDependencies'
import ThunkHandlerRegistry from './registries/ThunkHandlerRegistry'
import ValidationTemplateAnalyzer from './analyzers/ValidationTemplateAnalyzer'
import { NodeId } from '../types/engine.type'
import { IterateASTNode, SubmitTransitionASTNode } from '../types/expressions.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { PseudoNodeType } from '../types/pseudoNodes.type'
import { isASTNode } from '../typeguards/nodes'
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
  actionTransitionIds: NodeId[]
  submitTransitionIds: NodeId[]
  fieldIteratorRootIds: NodeId[]
  validationIterateNodeIds: NodeId[]
  validationBlockIds: NodeId[]
  domainValidationNodeIds: NodeId[]
  renderAncestorIds: NodeId[]
  renderStepId: NodeId
  isRenderSync: boolean
  isAnswerPrepareSync: boolean
  isValidationSync: boolean
  hasValidatingSubmitTransition: boolean
  hasDomainValidation: boolean
}

// ── Reachability runtime plan ───────────────────────────────────────

export interface ReachabilityRuntimePlan {
  entries: ReachabilityStepEntry[]
}

export interface ReachabilityStepEntry {
  stepId: NodeId
  path: string
  code?: string
  isEntryPoint: boolean
  forwardOutcomeIds: NodeId[]
  hasValidation: boolean
  cleardownFieldCodes: string[]
  fieldIteratorRootIds: NodeId[]
  validationIterateNodeIds: NodeId[]
  validationBlockIds: NodeId[]
  domainValidationNodeIds: NodeId[]
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
 * - Step runtime plans are built per-step during lazy compilation, adding
 *   sync-analysis flags that require the per-step thunk handler registry.
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
   * Build a reachability plan for every step, grouped by parent journey.
   *
   * Steps that share the same parent journey share the same plan. Returns a
   * map from stepId → plan so callers can look up the plan for any step.
   */
  buildAllReachabilityPlans(stepIndex: Map<NodeId, StepASTNode>): Map<NodeId, ReachabilityRuntimePlan> {
    const journeyStepMap = new Map<NodeId, StepASTNode[]>()
    const plansByStepId = new Map<NodeId, ReachabilityRuntimePlan>()

    stepIndex.forEach((stepNode, stepId) => {
      const ancestors = getAncestorChain(stepId, this.metadataRegistry)
      const parentJourneyId = ancestors[ancestors.length - 2]

      if (parentJourneyId) {
        const existingJourneySteps = journeyStepMap.get(parentJourneyId) ?? []

        existingJourneySteps.push(stepNode)
        journeyStepMap.set(parentJourneyId, existingJourneySteps)
      }
    })

    journeyStepMap.forEach(journeySteps => {
      const plan = this.buildReachabilityPlan(journeySteps)

      journeySteps.forEach(stepNode => {
        plansByStepId.set(stepNode.id, plan)
      })
    })

    return plansByStepId
  }

  private buildReachabilityPlan(journeySteps: StepASTNode[]): ReachabilityRuntimePlan {
    const entries = journeySteps.map(stepNode => this.buildReachabilityEntry(stepNode))

    return { entries }
  }

  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityStepEntry {
    const stepId = stepNode.id
    const { forwardOutcomeIds, hasValidation } = this.extractForwardNavigation(stepNode)
    const fieldIterateNodeIds = this.findFieldIterateNodeIds(stepId)
    const fieldIteratorRootIds = this.findIteratorRootIds(stepId, fieldIterateNodeIds)

    return {
      stepId,
      path: this.normalizePath(stepNode.properties.path),
      code: stepNode.properties.code,
      isEntryPoint: stepNode.properties.isEntryPoint === true,
      forwardOutcomeIds,
      hasValidation,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      fieldIteratorRootIds,
      validationIterateNodeIds: this.findValidationIterateNodeIds(fieldIterateNodeIds),
      validationBlockIds: this.findValidationBlockIds(stepId),
      domainValidationNodeIds: this.findDomainValidationNodeIds(stepNode),
    }
  }

  /**
   * Build a step runtime plan for a single step.
   *
   * Requires per-step compilation dependencies for sync-analysis flags
   * (isRenderSync, isAnswerPrepareSync, isValidationSync).
   */
  buildStepRuntimePlan(stepNode: StepASTNode, compilationDependencies: CompilationDependencies): StepRuntimePlan {
    const stepId = stepNode.id

    const accessAncestorIds = getAncestorChain(stepId, this.metadataRegistry)
    const actionTransitionIds = (stepNode.properties.onAction ?? []).map(transition => transition.id)
    const submitTransitionIds = (stepNode.properties.onSubmission ?? []).map(transition => transition.id)
    const fieldIterateNodeIds = this.findFieldIterateNodeIds(stepId)
    const fieldIteratorRootIds = this.findIteratorRootIds(stepId, fieldIterateNodeIds)
    const validationIterateNodeIds = this.findValidationIterateNodeIds(fieldIterateNodeIds)
    const validationBlockIds = this.findValidationBlockIds(stepId)
    const domainValidationNodeIds = this.findDomainValidationNodeIds(stepNode)
    const renderAncestorIds = accessAncestorIds.slice(0, -1)

    return {
      stepId,
      path: this.normalizePath(stepNode.properties.path),
      code: stepNode.properties.code,
      accessAncestorIds,
      actionTransitionIds,
      submitTransitionIds,
      fieldIteratorRootIds,
      validationIterateNodeIds,
      validationBlockIds,
      domainValidationNodeIds,
      renderAncestorIds,
      renderStepId: stepId,
      isRenderSync: this.computeIsRenderSync(stepNode, renderAncestorIds, compilationDependencies),
      isAnswerPrepareSync: this.computeIsAnswerPrepareSync(fieldIteratorRootIds, compilationDependencies),
      isValidationSync: this.computeIsValidationSync(
        validationIterateNodeIds,
        validationBlockIds,
        domainValidationNodeIds,
        compilationDependencies,
      ),
      hasValidatingSubmitTransition: this.computeHasValidatingSubmitTransition(stepNode),
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
      .filter(block => Array.isArray(block.properties.validate) && block.properties.validate.length > 0)
      .map(block => block.id)
  }

  private findDomainValidationNodeIds(stepNode: StepASTNode): NodeId[] {
    return (stepNode.properties.validate ?? []).map(node => node.id)
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
    const submitTransitions = stepNode.properties.onSubmission ?? []
    const validatingTransitions = submitTransitions.filter(t => t.properties.validate === true)

    if (validatingTransitions.length > 0) {
      return {
        forwardOutcomeIds: this.extractOutcomeIdsFromValidBranch(validatingTransitions),
        hasValidation: true,
      }
    }

    return {
      forwardOutcomeIds: this.extractOutcomeIdsFromAlwaysBranch(submitTransitions),
      hasValidation: false,
    }
  }

  private extractOutcomeIdsFromValidBranch(transitions: SubmitTransitionASTNode[]): NodeId[] {
    return transitions.flatMap(transition =>
      (transition.properties.onValid?.next ?? [])
        .filter(isRedirectOutcomeNode)
        .map(node => node.id),
    )
  }

  private extractOutcomeIdsFromAlwaysBranch(transitions: SubmitTransitionASTNode[]): NodeId[] {
    return transitions.flatMap(transition =>
      (transition.properties.onAlways?.next ?? [])
        .filter(isRedirectOutcomeNode)
        .map(node => node.id),
    )
  }

  // ── Sync analysis (per-step compilation only) ──────────────────

  private computeIsAnswerPrepareSync(
    fieldIteratorRootIds: NodeId[],
    compilationDependencies: CompilationDependencies,
  ): boolean {
    const handlerRegistry = compilationDependencies.thunkHandlerRegistry

    for (const rootId of fieldIteratorRootIds) {
      const handler = handlerRegistry.get(rootId)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    const answerLocalNodes = compilationDependencies.nodeRegistry.findByType(PseudoNodeType.ANSWER_LOCAL)
    const answerRemoteNodes = compilationDependencies.nodeRegistry.findByType(PseudoNodeType.ANSWER_REMOTE)

    for (const node of [...answerLocalNodes, ...answerRemoteNodes]) {
      const handler = handlerRegistry.get(node.id)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    return true
  }

  private computeIsRenderSync(
    stepNode: StepASTNode,
    renderAncestorIds: NodeId[],
    compilationDependencies: CompilationDependencies,
  ): boolean {
    const handlerRegistry = compilationDependencies.thunkHandlerRegistry
    const stepExcludedProps = new Set(['onAccess', 'onAction', 'onSubmission', 'blocks', 'validate'])
    const ancestorExcludedProps = new Set(['onAccess', 'children', 'steps'])

    const blocks = stepNode.properties.blocks ?? []

    if (!this.isValueTreeSync(blocks, handlerRegistry)) {
      return false
    }

    if (!this.areFilteredPropertiesSync(stepNode.properties, stepExcludedProps, handlerRegistry)) {
      return false
    }

    for (const ancestorId of renderAncestorIds) {
      const ancestorNode = compilationDependencies.nodeRegistry.get(ancestorId) as JourneyASTNode | undefined

      if (
        ancestorNode &&
        !this.areFilteredPropertiesSync(ancestorNode.properties, ancestorExcludedProps, handlerRegistry)
      ) {
        return false
      }
    }

    return true
  }

  private areFilteredPropertiesSync(
    properties: Record<string, unknown>,
    excludedKeys: Set<string>,
    handlerRegistry: ThunkHandlerRegistry,
  ): boolean {
    return Object.entries(properties)
      .filter(([key]) => !excludedKeys.has(key))
      .every(([, value]) => this.isValueTreeSync(value, handlerRegistry))
  }

  private computeIsValidationSync(
    validationIterateNodeIds: NodeId[],
    validationBlockIds: NodeId[],
    domainValidationNodeIds: NodeId[],
    compilationDependencies: CompilationDependencies,
  ): boolean {
    const handlerRegistry = compilationDependencies.thunkHandlerRegistry

    for (const iterateNodeId of validationIterateNodeIds) {
      const handler = handlerRegistry.get(iterateNodeId)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    for (const blockId of validationBlockIds) {
      const block = compilationDependencies.nodeRegistry.get(blockId) as FieldBlockASTNode | undefined

      if (block) {
        if (!this.isValueTreeSync(block.properties.validate, handlerRegistry)) {
          return false
        }

        if (!this.isValueTreeSync(block.properties.dependent, handlerRegistry)) {
          return false
        }

        if (!this.isValueTreeSync(block.properties.code, handlerRegistry)) {
          return false
        }
      }
    }

    for (const nodeId of domainValidationNodeIds) {
      const handler = handlerRegistry.get(nodeId)

      if (!handler || handler.isAsync) {
        return false
      }
    }

    return true
  }

  private computeHasValidatingSubmitTransition(stepNode: StepASTNode): boolean {
    return (stepNode.properties.onSubmission ?? []).some(
      (transition: SubmitTransitionASTNode) => transition.properties.validate === true,
    )
  }

  private isValueTreeSync(value: unknown, handlerRegistry: ThunkHandlerRegistry): boolean {
    if (value === null || value === undefined) {
      return true
    }

    if (isASTNode(value)) {
      const handler = handlerRegistry.get(value.id)

      return handler !== undefined && !handler.isAsync
    }

    if (Array.isArray(value)) {
      return value.every(element => this.isValueTreeSync(element, handlerRegistry))
    }

    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).every(v => this.isValueTreeSync(v, handlerRegistry))
    }

    return true
  }

  private normalizePath(path: string): string {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path

    return normalizedPath.split(/[?#]/)[0] ?? normalizedPath
  }
}

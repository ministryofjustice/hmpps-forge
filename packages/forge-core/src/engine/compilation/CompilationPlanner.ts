import { normalizeRelativePath } from '../../framework/path/routePath'
import { BlockType, ExpressionType, IteratorType } from '../../authoring/types/enums'
import type { ASTNode, NodeId } from '../types/ast.type'
import type { IterateASTNode, ReferenceASTNode, SubmitHookASTNode } from '../types/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import { isASTNode } from '../typeguards/nodes'
import { isRedirectOutcomeNode } from '../typeguards/outcome-nodes'
import getAncestorChain from '../utils/getAncestorChain'
import type ASTNodeTree from './node-tree/ASTNodeTree'
import type NodeRegistry from './registries/NodeRegistry'
import type {
  ForwardOutcomeGroup,
  JourneyRuntimePlan,
  NavigationRuntimePlan,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
  StepRuntimePlan,
} from '../types/runtimePlans.type'
import type {
  CompilationPlan,
  FieldInventoryStepSource,
  JourneyCompilationInputs,
  StepCompilationInputs,
} from '../types/compilationPlan.type'

type StepIndex = Map<NodeId, StepASTNode>
type JourneyIndex = Map<NodeId, JourneyASTNode>

export default class CompilationPlanner {
  private readonly allFieldBlocks: FieldBlockASTNode[]

  private readonly allMapIterateNodes: IterateASTNode[]

  private readonly allIterateNodes: IterateASTNode[]

  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly astNodeTree: ASTNodeTree,
  ) {
    this.allFieldBlocks = nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    this.allMapIterateNodes = nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)
    this.allIterateNodes = nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
  }

  buildPlan(stepIndex: StepIndex, journeyIndex: JourneyIndex): CompilationPlan {
    const journeyStepMap = new Map<NodeId, StepASTNode[]>()
    const stepInputs = new Map<NodeId, StepCompilationInputs>()
    const navigationPlansByStepId = new Map<NodeId, NavigationRuntimePlan>()
    const reachabilityPlans: ReachabilityCompilationPlan[] = []
    const journeyRuntimePlans = new Map<NodeId, JourneyRuntimePlan>()
    const journeyInputs = new Map<NodeId, JourneyCompilationInputs>()
    const fieldInventorySources = new Map<NavigationRuntimePlan, FieldInventoryStepSource[]>()

    stepIndex.forEach((stepNode, stepId) => {
      const runtimePlan = this.buildStepRuntimePlan(stepNode)

      stepInputs.set(stepId, this.buildStepInputs(stepNode, runtimePlan))

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
        navigationPlansByStepId.set(stepNode.id, reachabilityPlan.navigationPlan)
      })

      reachabilityPlans.push(reachabilityPlan)
      fieldInventorySources.set(reachabilityPlan.navigationPlan, this.buildFieldInventorySources(reachabilityPlan))

      if (journeyNode) {
        const journeyRuntimePlan = this.buildJourneyRuntimePlan(journeyNode, reachabilityPlan.navigationPlan)

        journeyRuntimePlans.set(journeyId, journeyRuntimePlan)
        journeyInputs.set(journeyId, this.buildJourneyInputs(journeyNode, journeyRuntimePlan))
      }
    })

    return {
      stepInputs,
      journeyInputs,
      reachabilityPlans,
      fieldInventorySources,
      navigationPlansByStepId,
      journeyRuntimePlans,
    }
  }

  private buildStepInputs(stepNode: StepASTNode, runtimePlan: StepRuntimePlan): StepCompilationInputs {
    const stepId = stepNode.id
    const fieldBlocks = this.allFieldBlocks
      .filter(block => this.astNodeTree.isDescendantOf(block.id, stepId))
    const validatingFieldBlocks = fieldBlocks
      .filter(block => hasConfiguredValue(block.properties.validWhen))
    const mapIterateNodes = this.allMapIterateNodes
      .filter(node => this.astNodeTree.isDescendantOf(node.id, stepId))
    const allIterateNodes = this.allIterateNodes
      .filter(node => this.astNodeTree.isDescendantOf(node.id, stepId))

    return {
      stepNode,
      runtimePlan,
      fieldBlocks,
      validatingFieldBlocks,
      mapIterateNodes,
      allIterateNodes,
      accessAncestors: this.resolveAccessAncestors(stepId),
      renderAncestors: this.resolveRenderAncestors(stepId),
      submitHooks: stepNode.properties.onSubmission ?? [],
    }
  }

  private buildJourneyInputs(journeyNode: JourneyASTNode, runtimePlan: JourneyRuntimePlan): JourneyCompilationInputs {
    const stepIds = runtimePlan.navigationPlan.entries.map(entry => entry.stepId)
    const stepFieldBlocks = this.allFieldBlocks
      .filter(block => stepIds.some(stepId => this.astNodeTree.isDescendantOf(block.id, stepId)))
    const stepMapIterateNodes = this.allMapIterateNodes
      .filter(node => stepIds.some(stepId => this.astNodeTree.isDescendantOf(node.id, stepId)))

    return {
      journeyNode,
      runtimePlan,
      stepFieldBlocks,
      stepMapIterateNodes,
      accessAncestors: this.resolveAccessAncestors(journeyNode.id),
    }
  }

  private buildFieldInventorySources(plan: ReachabilityCompilationPlan): FieldInventoryStepSource[] {
    return plan.entries.map(entry => ({
      stepId: entry.stepId,
      cleardownFieldCodes: entry.cleardownFieldCodes,
      fieldBlocks: this.allFieldBlocks
        .filter(block => this.astNodeTree.isDescendantOf(block.id, entry.stepId)),
      iterateNodes: this.allMapIterateNodes
        .filter(node => this.astNodeTree.isDescendantOf(node.id, entry.stepId)),
    }))
  }

  private buildStepRuntimePlan(stepNode: StepASTNode): StepRuntimePlan {
    return {
      stepId: stepNode.id,
      path: normalizeRelativePath(stepNode.properties.path),
      staticData: this.buildStaticData(getAncestorChain(stepNode.id, this.astNodeTree)),
    }
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

  private buildReachabilityEntry(stepNode: StepASTNode): ReachabilityCompilationEntry {
    const stepId = stepNode.id
    const { forwardOutcomeGroups } = this.extractForwardNavigation(stepNode)
    const hasValidation = this.hasValidationBlocks(stepId) || hasConfiguredValue(stepNode.properties.validWhen)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      stepId,
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhenNodeId: entryWhen !== undefined && entryWhen !== true ? entryWhen.id : undefined,
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

  private resolveAccessAncestors(nodeId: NodeId): Array<JourneyASTNode | StepASTNode> {
    return getAncestorChain(nodeId, this.astNodeTree)
      .map(ancestorId => this.nodeRegistry.get(ancestorId))
      .filter(this.isAccessAncestor)
  }

  private resolveRenderAncestors(stepId: NodeId): JourneyASTNode[] {
    return getAncestorChain(stepId, this.astNodeTree)
      .slice(0, -1)
      .map(ancestorId => this.nodeRegistry.get(ancestorId))
      .filter(this.isJourneyNode)
  }

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

  private hasValidationBlocks(stepId: NodeId): boolean {
    return this.allFieldBlocks
      .filter(block => this.astNodeTree.isDescendantOf(block.id, stepId))
      .some(block => hasConfiguredValue(block.properties.validWhen))
  }

  private extractForwardNavigation(stepNode: StepASTNode): { forwardOutcomeGroups: ForwardOutcomeGroup[] } {
    const submitHooks = stepNode.properties.onSubmission ?? []

    const forwardOutcomeGroups: ForwardOutcomeGroup[] = submitHooks
      .map(hook => this.buildForwardOutcomeGroup(hook))
      .filter(group => group.outcomeIds.length > 0)

    return { forwardOutcomeGroups }
  }

  private buildForwardOutcomeGroup(hook: SubmitHookASTNode): ForwardOutcomeGroup {
    const alwaysOutcomeIds = (hook.properties.onAlways?.next ?? [])
      .filter(isRedirectOutcomeNode)
      .map(node => node.id)
    const validOutcomeIds = hook.properties.validate
      ? (hook.properties.onValid?.next ?? []).filter(isRedirectOutcomeNode).map(node => node.id)
      : []

    return {
      hookWhenNodeId: this.resolveReachabilityCompilableHookWhen(hook.properties.when),
      outcomeIds: [...alwaysOutcomeIds, ...validOutcomeIds],
    }
  }

  /**
   * Returns the hook's `when:` node id only if the predicate is safe to evaluate
   * at reachability time. Reachability runs per-step against the *current* request
   * context, so guards that reference namespaces tied to a different request
   * (post body, URL params, query string, request metadata) must be treated as
   * unknown and over-approximated instead of evaluated against the wrong context.
   */
  private resolveReachabilityCompilableHookWhen(when: ASTNode | undefined): NodeId | undefined {
    if (when === undefined || !isASTNode(when)) {
      return undefined
    }

    if (containsRequestTimeReference(when)) {
      return undefined
    }

    return when.id
  }

  private isAccessAncestor(node: ASTNode | undefined): node is JourneyASTNode | StepASTNode {
    return node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP
  }

  private isJourneyNode(node: ASTNode | undefined): node is JourneyASTNode {
    return node?.type === ASTNodeType.JOURNEY
  }

  private isStaticDataNode(node: ASTNode | undefined): node is JourneyASTNode | StepASTNode {
    return node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP
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

// Namespaces whose values are tied to a single request and would resolve against
// the wrong context if a predicate references them while reachability is being
// evaluated for a step the user is not currently on. `session` and `data` are
// stable across requests so they remain safe to evaluate.
const REQUEST_TIME_NAMESPACES: ReadonlySet<string> = new Set(['post', 'params', 'query', 'request'])

function containsRequestTimeReference(node: ASTNode): boolean {
  if (isRequestTimeReference(node)) {
    return true
  }

  const properties = (node as { properties?: Record<string, unknown> }).properties

  if (properties === undefined) {
    return false
  }

  return Object.values(properties).some(containsRequestTimeReferenceInValue)
}

function containsRequestTimeReferenceInValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsRequestTimeReferenceInValue)
  }

  if (isASTNode(value)) {
    return containsRequestTimeReference(value)
  }

  return false
}

function isRequestTimeReference(node: ASTNode): boolean {
  if (node.type !== ASTNodeType.EXPRESSION) {
    return false
  }

  const reference = node as ReferenceASTNode

  if (reference.expressionType !== ExpressionType.REFERENCE) {
    return false
  }

  const root = reference.properties.path[0]

  return typeof root === 'string' && REQUEST_TIME_NAMESPACES.has(root)
}

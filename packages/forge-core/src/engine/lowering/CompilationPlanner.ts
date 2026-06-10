import { normalizeRelativePath } from '../../framework/path/routePath'
import { BlockType, ExpressionType, IteratorType } from '../../authoring/types/enums'
import type { ASTNode, NodeId } from '../contracts/ast/ast.type'
import type { IterateASTNode, ReferenceASTNode, SubmitHookASTNode } from '../contracts/ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import { ASTNodeType } from '../contracts/ast/enums'
import { isASTNode } from '../contracts/ast/nodes'
import { isRedirectOutcomeNode } from '../contracts/ast/outcome-nodes'
import getAncestorChain from '../ast/ast-state/getAncestorChain'
import type ASTNodeTree from '../ast/ast-state/ASTNodeTree'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import type { RuntimePlan } from '../contracts/plans/runtimePlans.type'
import type {
  CompilationPlan,
  FieldInventoryStepSource,
  ForwardOutcomeGroup,
  JourneyCompilationInputs,
  ReachabilityStepInputs,
  ReachabilityCompilationPlan,
  StepCompilationInputs,
} from '../contracts/plans/compilationPlan.type'

type StepIndex = Map<NodeId, StepASTNode>
type JourneyIndex = Map<NodeId, JourneyASTNode>

export default class CompilationPlanner {
  private readonly allFieldBlocks: FieldBlockASTNode[]

  private readonly allMapIterateNodes: IterateASTNode[]

  private readonly allIterateNodes: IterateASTNode[]

  constructor(
    private readonly nodeRegistry: ASTNodeIndex,
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
    const navigationPlanNodeIdByStepNodeId = new Map<NodeId, NodeId>()
    const reachabilityPlans = new Map<NodeId, ReachabilityCompilationPlan>()
    const journeyInputs = new Map<NodeId, JourneyCompilationInputs>()

    stepIndex.forEach((stepNode, stepNodeId) => {
      const runtimePlan = this.buildRuntimePlan(stepNode)

      stepInputs.set(stepNodeId, this.buildStepInputs(stepNode, runtimePlan))

      const ancestors = getAncestorChain(stepNodeId, this.astNodeTree)
      const parentJourneyNodeId = ancestors[ancestors.length - 2]

      if (parentJourneyNodeId) {
        const existingJourneySteps = journeyStepMap.get(parentJourneyNodeId) ?? []

        existingJourneySteps.push(stepNode)
        journeyStepMap.set(parentJourneyNodeId, existingJourneySteps)
      }
    })

    journeyStepMap.forEach((journeySteps, journeyNodeId) => {
      const journeyNode = journeyIndex.get(journeyNodeId)
      const reachabilityPlan = this.buildReachabilityPlan(journeyNodeId, journeySteps, journeyNode, journeyIndex)

      journeySteps.forEach(stepNode => {
        navigationPlanNodeIdByStepNodeId.set(stepNode.id, reachabilityPlan.journeyNodeId)
      })

      reachabilityPlans.set(reachabilityPlan.journeyNodeId, reachabilityPlan)

      if (journeyNode) {
        const journeyRuntimePlan = this.buildRuntimePlan(journeyNode)

        journeyInputs.set(journeyNodeId, this.buildJourneyInputs(journeyNode, journeyRuntimePlan, reachabilityPlan))
      }
    })

    return {
      stepInputs,
      journeyInputs,
      reachabilityPlans,
      navigationPlanNodeIdByStepNodeId,
    }
  }

  private buildStepInputs(stepNode: StepASTNode, runtimePlan: RuntimePlan): StepCompilationInputs {
    const stepNodeId = stepNode.id
    const fieldBlocks = this.allFieldBlocks
      .filter(block => this.astNodeTree.isDescendantOf(block.id, stepNodeId))
    const validatingFieldBlocks = fieldBlocks
      .filter(block => hasConfiguredValue(block.properties.validWhen))
    const mapIterateNodes = this.allMapIterateNodes
      .filter(node => this.astNodeTree.isDescendantOf(node.id, stepNodeId))
    const allIterateNodes = this.allIterateNodes
      .filter(node => this.astNodeTree.isDescendantOf(node.id, stepNodeId))

    return {
      stepNode,
      runtimePlan,
      fieldBlocks,
      validatingFieldBlocks,
      mapIterateNodes,
      allIterateNodes,
      accessAncestors: this.resolveAccessAncestors(stepNodeId),
      renderAncestors: this.resolveRenderAncestors(stepNodeId),
      submitHooks: stepNode.properties.onSubmission ?? [],
      entryValidations: stepNode.properties.validateOnEntry ?? [],
    }
  }

  private buildJourneyInputs(
    journeyNode: JourneyASTNode,
    runtimePlan: RuntimePlan,
    reachabilityPlan: ReachabilityCompilationPlan,
  ): JourneyCompilationInputs {
    const stepNodeIds = reachabilityPlan.reachabilityStepInputs.map(step => step.nodeId)
    const stepFieldBlocks = this.allFieldBlocks
      .filter(block => stepNodeIds.some(stepNodeId => this.astNodeTree.isDescendantOf(block.id, stepNodeId)))
    const stepMapIterateNodes = this.allMapIterateNodes
      .filter(node => stepNodeIds.some(stepNodeId => this.astNodeTree.isDescendantOf(node.id, stepNodeId)))

    return {
      journeyNode,
      runtimePlan,
      reachabilityPlanId: reachabilityPlan.journeyNodeId,
      stepFieldBlocks,
      stepMapIterateNodes,
      accessAncestors: this.resolveAccessAncestors(journeyNode.id),
    }
  }

  private buildRuntimePlan(node: StepASTNode | JourneyASTNode): RuntimePlan {
    return {
      nodeId: node.id,
      path: normalizeRelativePath(node.properties.path),
      staticData: this.buildStaticData(getAncestorChain(node.id, this.astNodeTree)),
    }
  }

  private buildReachabilityPlan(
    journeyNodeId: NodeId,
    journeySteps: StepASTNode[],
    journeyNode: JourneyASTNode | undefined,
    journeyIndex: JourneyIndex,
  ): ReachabilityCompilationPlan {
    const steps = journeySteps.map(stepNode => this.buildReachabilityStepInputs(stepNode))
    const resumeWhen = journeyNode?.properties.reachability?.resumeWhen
    const resumeAlways = resumeWhen === true
    const resumeWhenNodeId = resumeWhen !== undefined && resumeWhen !== true ? resumeWhen.id : undefined

    return {
      journeyNodeId,
      reachabilityStepInputs: steps,
      resumeConfigured: resumeAlways || resumeWhenNodeId !== undefined,
      resumeAlways,
      resumeWhenNodeId,
      unreachableRedirect: journeyNode?.properties.reachability?.unreachableRedirect ?? 'entry',
      reachabilityDisabled: this.resolveReachabilityDisabled(journeyNode, journeyIndex),
    }
  }

  private buildReachabilityStepInputs(stepNode: StepASTNode): ReachabilityStepInputs {
    const stepNodeId = stepNode.id
    const { forwardOutcomeGroups, declaredOutcomes } = this.extractForwardNavigation(stepNode)

    const reachability = stepNode.properties.reachability
    const entryWhen = reachability?.entryWhen

    return {
      nodeId: stepNodeId,
      code: stepNode.properties.code,
      isEntryPoint: entryWhen === true,
      entryWhenNodeId: entryWhen !== undefined && entryWhen !== true ? entryWhen.id : undefined,
      forwardOutcomeGroups,
      declaredOutcomes,
      cleardownFieldCodes: stepNode.properties.cleardownFieldCodes ?? [],
      reachabilityTieBreakers: (reachability?.tieBreakers ?? []).map(tieBreaker => ({
        priority: tieBreaker.properties.priority,
        whenNodeId: tieBreaker.properties.when?.id,
      })),
      fieldInventorySource: this.buildFieldInventorySource(stepNodeId, stepNode.properties.cleardownFieldCodes ?? []),
    }
  }

  private buildFieldInventorySource(
    stepNodeId: NodeId,
    cleardownFieldCodes: readonly string[],
  ): FieldInventoryStepSource {
    return {
      stepNodeId,
      cleardownFieldCodes,
      fieldBlocks: this.allFieldBlocks
        .filter(block => this.astNodeTree.isDescendantOf(block.id, stepNodeId)),
      iterateNodes: this.allMapIterateNodes
        .filter(node => this.astNodeTree.isDescendantOf(node.id, stepNodeId)),
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

  private resolveRenderAncestors(stepNodeId: NodeId): JourneyASTNode[] {
    return getAncestorChain(stepNodeId, this.astNodeTree)
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

  /**
   * Groups the step's forward outcomes per submit hook for the compiler's
   * cascades, and collects the statically-declared goto strings across all
   * hooks — known at plan time, regardless of guards — for the devtools graph.
   */
  private extractForwardNavigation(stepNode: StepASTNode): {
    forwardOutcomeGroups: ForwardOutcomeGroup[]
    declaredOutcomes: string[]
  } {
    const submitHooks = stepNode.properties.onSubmission ?? []

    const forwardOutcomeGroups: ForwardOutcomeGroup[] = submitHooks
      .map(hook => this.buildForwardOutcomeGroup(hook))
      .filter(group => group.outcomeIds.length > 0)

    const declaredOutcomes = forwardOutcomeGroups.flatMap(group =>
      group.outcomeIds
        .map(outcomeId => this.nodeRegistry.get(outcomeId))
        .filter(isRedirectOutcomeNode)
        .map(outcome => outcome.properties.goto)
        .filter((goto): goto is string => typeof goto === 'string'),
    )

    return { forwardOutcomeGroups, declaredOutcomes }
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

import type { NodeId } from '../ast/ast.type'
import type { IterateASTNode, SubmitHookASTNode } from '../ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode, StepEntryValidationAST } from '../ast/structures.type'
import type { RuntimePlan } from './runtimePlans.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'

export interface ReachabilityTieBreakerRule {
  readonly priority: number
  readonly whenNodeId?: NodeId
}

/**
 * Per-submit-hook grouping of forward outcomes. Each group corresponds to one
 * submit hook on the source step; the cascade short-circuit applies within a
 * group but never across groups.
 *
 * `hookWhenNodeId` is set only when the hook's `when:` is reachability-compilable
 * (does not reference request-time namespaces like post/params/query/request).
 * When set, the compiler wraps the group in `if (Boolean(whenExpr))`. When
 * unset, the group contributes its outcomes unguarded — an intentional
 * over-approximation for non-evaluable guards.
 */
export interface ForwardOutcomeGroup {
  readonly hookWhenNodeId?: NodeId
  readonly outcomeIds: readonly NodeId[]
}

/**
 * Compile-time inputs for one journey step's navigation leaves. The planner
 * builds one per step; its data fields are projected into the step's
 * CompiledNavigationStep, while the node ids feed the ReachabilityCompiler.
 */
export interface ReachabilityStepInputs {
  readonly nodeId: NodeId
  readonly code?: string
  readonly isEntryPoint: boolean
  /** Field codes cleared down when the step becomes unreachable. */
  readonly cleardownFieldCodes: readonly string[]
  /** Statically-declared forward gotos across all hooks, regardless of guards (devtools-only). */
  readonly declaredOutcomes: readonly string[]
  readonly entryWhenNodeId?: NodeId
  readonly forwardOutcomeGroups: readonly ForwardOutcomeGroup[]
  readonly reachabilityTieBreakers: readonly ReachabilityTieBreakerRule[]
  readonly fieldInventorySource: FieldInventoryStepSource
}

export interface ReachabilityCompilationPlan {
  readonly journeyNodeId: NodeId
  readonly reachabilityStepInputs: readonly ReachabilityStepInputs[]
  readonly resumeConfigured: boolean
  readonly resumeAlways: boolean
  readonly resumeWhenNodeId?: NodeId
  readonly unreachableRedirect: UnreachableRedirectTarget
  readonly reachabilityDisabled: boolean
}

export interface FieldAnswerPreparationSource {
  readonly kind: 'field'
  readonly node: FieldBlockASTNode
}

export interface MaterialisationRootAnswerPreparationSource {
  readonly kind: 'materialisation-root'
  readonly node: IterateASTNode
}

export type AnswerPreparationSource = FieldAnswerPreparationSource | MaterialisationRootAnswerPreparationSource

export interface StepCompilationInputs {
  readonly stepNode: StepASTNode
  readonly runtimePlan: RuntimePlan
  readonly fieldBlocks: FieldBlockASTNode[]
  readonly validatingFieldBlocks: FieldBlockASTNode[]
  readonly mapIterateNodes: IterateASTNode[]
  readonly materialisationRootNodes: IterateASTNode[]
  readonly allIterateNodes: IterateASTNode[]
  readonly answerPreparationSources: readonly AnswerPreparationSource[]
  readonly accessAncestors: Array<JourneyASTNode | StepASTNode>
  readonly renderAncestors: JourneyASTNode[]
  readonly submitHooks: SubmitHookASTNode[]
  readonly entryValidations: readonly StepEntryValidationAST[]
}

export interface JourneyCompilationInputs {
  readonly journeyNode: JourneyASTNode
  readonly runtimePlan: RuntimePlan
  readonly reachabilityPlanId: NodeId
  readonly stepFieldBlocks: FieldBlockASTNode[]
  readonly stepMapIterateNodes: IterateASTNode[]
  readonly stepMaterialisationRootNodes: IterateASTNode[]
  readonly answerPreparationSources: readonly AnswerPreparationSource[]
  readonly accessAncestors: Array<JourneyASTNode | StepASTNode>
}

export interface FieldInventoryStepSource {
  readonly fieldBlocks: readonly FieldBlockASTNode[]
  readonly iterateNodes: readonly IterateASTNode[]
}

export interface CompilationPlan {
  readonly stepInputs: Map<NodeId, StepCompilationInputs>
  readonly journeyInputs: Map<NodeId, JourneyCompilationInputs>
  readonly reachabilityPlans: Map<NodeId, ReachabilityCompilationPlan>
  readonly navigationPlanNodeIdByStepNodeId: Map<NodeId, NodeId>
}

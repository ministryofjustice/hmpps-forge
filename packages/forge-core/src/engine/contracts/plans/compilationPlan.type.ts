import type { NodeId } from '../ast/ast.type'
import type { IterateASTNode, SubmitHookASTNode } from '../ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../ast/structures.type'
import type { JourneyRuntimePlan, NavigationRuntimePlan, StepRuntimePlan } from './runtimePlans.type'

export interface ReachabilityTieBreakerEntry {
  priority: number
  whenNodeId?: NodeId
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
  hookWhenNodeId?: NodeId
  outcomeIds: NodeId[]
}

/**
 * Compile-time inputs for one journey step's navigation leaves. The planner
 * builds one per step; its data fields are projected into the step's
 * NavigationRuntimeEntry, while the node ids feed the ReachabilityCompiler.
 */
export interface ReachabilityCompilationEntry {
  stepId: NodeId
  code?: string
  isEntryPoint: boolean
  hasValidation: boolean
  /** Field codes cleared down when the step becomes unreachable. */
  cleardownFieldCodes: string[]
  /** Statically-declared forward gotos across all hooks, regardless of guards (devtools-only). */
  declaredOutcomes: string[]
  entryWhenNodeId?: NodeId
  forwardOutcomeGroups: ForwardOutcomeGroup[]
  reachabilityTieBreakers: ReachabilityTieBreakerEntry[]
}

export interface ReachabilityCompilationPlan {
  navigationPlan: NavigationRuntimePlan
  entries: ReachabilityCompilationEntry[]
  resumeAlways: boolean
  resumeWhenNodeId?: NodeId
}

export interface StepCompilationInputs {
  readonly stepNode: StepASTNode
  readonly runtimePlan: StepRuntimePlan
  readonly fieldBlocks: FieldBlockASTNode[]
  readonly validatingFieldBlocks: FieldBlockASTNode[]
  readonly mapIterateNodes: IterateASTNode[]
  readonly allIterateNodes: IterateASTNode[]
  readonly accessAncestors: Array<JourneyASTNode | StepASTNode>
  readonly renderAncestors: JourneyASTNode[]
  readonly submitHooks: SubmitHookASTNode[]
}

export interface JourneyCompilationInputs {
  readonly journeyNode: JourneyASTNode
  readonly runtimePlan: JourneyRuntimePlan
  readonly navigationPlan: NavigationRuntimePlan
  readonly stepFieldBlocks: FieldBlockASTNode[]
  readonly stepMapIterateNodes: IterateASTNode[]
  readonly accessAncestors: Array<JourneyASTNode | StepASTNode>
}

export interface FieldInventoryStepSource {
  readonly stepId: string
  readonly fieldBlocks: FieldBlockASTNode[]
  readonly iterateNodes: IterateASTNode[]
  readonly cleardownFieldCodes: string[]
}

export interface CompilationPlan {
  readonly stepInputs: Map<NodeId, StepCompilationInputs>
  readonly journeyInputs: Map<NodeId, JourneyCompilationInputs>
  readonly reachabilityPlans: ReachabilityCompilationPlan[]
  readonly fieldInventorySources: Map<NavigationRuntimePlan, FieldInventoryStepSource[]>
  readonly navigationPlansByStepId: Map<NodeId, NavigationRuntimePlan>
}

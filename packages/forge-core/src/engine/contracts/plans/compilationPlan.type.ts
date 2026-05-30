import type { NodeId } from '../ast/ast.type'
import type { IterateASTNode, SubmitHookASTNode } from '../ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../ast/structures.type'
import type {
  JourneyRuntimePlan,
  NavigationRuntimePlan,
  ReachabilityCompilationPlan,
  StepRuntimePlan,
} from './runtimePlans.type'

export interface ReachabilityTieBreakerEntry {
  priority: number
  whenNodeId?: NodeId
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

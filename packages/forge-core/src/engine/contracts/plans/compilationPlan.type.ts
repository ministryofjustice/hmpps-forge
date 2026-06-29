import type { NodeId } from '../ast/ast.type'
import type { AccessHookASTNode, IterateASTNode, SubmitHookASTNode } from '../ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../ast/structures.type'
import type {
  JourneyRuntimePlan,
  ReachabilityStateTable,
  ReachabilityCompilationPlan,
  StepRuntimePlan,
} from './runtimePlans.type'

export interface ReachabilityTieBreakerEntry {
  priority: number
  whenNodeId?: NodeId
}

export interface StepCoreInputs {
  readonly stepNode: StepASTNode
  readonly runtimePlan: StepRuntimePlan
  readonly staticData: Record<string, unknown>
  readonly reachabilityId: NodeId
}

export interface AnswerPreparationInputs {
  readonly fieldBlocks: FieldBlockASTNode[]
  readonly mapIterateNodes: IterateASTNode[]
}

export interface HookInputs {
  readonly accessHooks: AccessHookASTNode[]
  readonly submitHooks: SubmitHookASTNode[]
}

export interface ValidationInputs {
  readonly stepNode: StepASTNode
  /**
   * Whether the step has real validation (validating field blocks or a domain
   * `validWhen`). Owns the answer to "which steps does the eager validities phase
   * validate" — independent of reachability/navigation.
   */
  readonly hasValidation: boolean
  readonly validatingFieldBlocks: FieldBlockASTNode[]
  readonly mapIterateNodes: IterateASTNode[]
}

export interface ResolveInputs {
  readonly stepNode: StepASTNode
  readonly ancestorJourneys: JourneyASTNode[]
  readonly allIterateNodes: IterateASTNode[]
}

export interface StepCompilationInputs {
  readonly core: StepCoreInputs
  readonly answerPreparation: AnswerPreparationInputs
  readonly hooks: HookInputs
  readonly validation: ValidationInputs
  readonly resolve: ResolveInputs
}

export interface JourneyCompilationInputs {
  readonly runtimePlan: JourneyRuntimePlan
  readonly staticData: Record<string, unknown>
  readonly stepFieldBlocks: FieldBlockASTNode[]
  readonly stepMapIterateNodes: IterateASTNode[]
  readonly accessHooks: AccessHookASTNode[]
}

export interface FieldInventoryStepSource {
  readonly stepId: string
  readonly fieldBlocks: FieldBlockASTNode[]
  readonly iterateNodes: IterateASTNode[]
  readonly cleardownFieldCodes: string[]
}

export interface ReachabilityCompilationInputs {
  readonly reachabilityId: NodeId
  readonly stateTable: ReachabilityStateTable
  readonly reachabilityPlan: ReachabilityCompilationPlan
  readonly fieldInventorySources: FieldInventoryStepSource[]
}

export interface CompilationPlan {
  readonly stepInputs: ReadonlyMap<NodeId, StepCompilationInputs>
  readonly journeyInputs: ReadonlyMap<NodeId, JourneyCompilationInputs>
  readonly reachabilityInputs: ReadonlyMap<NodeId, ReachabilityCompilationInputs>
}

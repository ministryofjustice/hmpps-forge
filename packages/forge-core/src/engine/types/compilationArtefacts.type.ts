import type { NodeId } from './ast.type'
import type { JourneyASTNode, StepASTNode } from './structures.type'
import type { NavigationRuntimePlan, StepRuntimePlan } from './runtimePlans.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledRenderFunction,
  CompiledValidationFunction,
} from './compiledPhaseResults.type'

export type StepIndex = Map<NodeId, StepASTNode>

export type JourneyIndex = Map<NodeId, JourneyASTNode>

export interface CompiledStep {
  runtimePlan: StepRuntimePlan
  navigationPlan: NavigationRuntimePlan
  compiledValidation?: CompiledValidationFunction
  compiledEntryValidation?: CompiledEntryValidationFunction
  compiledRender?: CompiledRenderFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction | undefined
}

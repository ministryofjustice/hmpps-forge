import type { NodeId } from './ast.type'
import type { JourneyASTNode, StepASTNode } from './structures.type'
import type { JourneyRuntimePlan, NavigationRuntimePlan, StepRuntimePlan } from './runtimePlans.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledRenderFunction,
  CompiledValidationFunction,
} from './compiledPhaseResults.type'
import type { CompilationContext } from '../compilation/CompilationContext'

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

export interface JourneyCompilationResult {
  readonly rootNode: JourneyASTNode
  readonly context: CompilationContext
  readonly stepIndex: StepIndex
  readonly journeyIndex: JourneyIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeyPlans: Map<NodeId, JourneyRuntimePlan>
}

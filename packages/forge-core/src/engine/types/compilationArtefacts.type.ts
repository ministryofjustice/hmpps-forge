import type { NodeId } from './ast.type'
import type { JourneyASTNode, StepASTNode } from './structures.type'
import type { CompilationContext } from '../compilation/CompilationContext'
import type {
  JourneyRuntimePlan,
  NavigationRuntimePlan,
  ReachabilityCompilationPlan,
  StepRuntimePlan,
} from './runtimePlans.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledRenderFunction,
  CompiledValidationFunction,
} from './compiledPhaseResults.type'

export type StepIndex = Map<NodeId, StepASTNode>

export type JourneyIndex = Map<NodeId, JourneyASTNode>

export interface SharedCompiledForm {
  rootNode: JourneyASTNode
  sharedContext: CompilationContext
  stepIndex: StepIndex
  journeyIndex: JourneyIndex
  stepRuntimePlans: Map<NodeId, StepRuntimePlan>
  navigationPlans: Map<NodeId, NavigationRuntimePlan>
  reachabilityCompilationPlans: ReachabilityCompilationPlan[]
  journeyRuntimePlans: Map<NodeId, JourneyRuntimePlan>
}

export interface CompiledStep {
  runtimePlan: StepRuntimePlan
  navigationPlan: NavigationRuntimePlan
  compiledValidation?: CompiledValidationFunction
  compiledEntryValidation?: CompiledEntryValidationFunction
  compiledRender?: CompiledRenderFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction | undefined
}

export type CompiledForm = CompiledStep[]

export type CompilationArtefact = CompilationContext

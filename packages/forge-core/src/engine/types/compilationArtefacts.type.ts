import type { NodeId } from './ast.type'
import type { JourneyRouteIndex, StepRouteIndex } from './routeDescriptors.type'
import type { JourneyRuntimePlan, NavigationRuntimePlan, StepRuntimePlan } from './runtimePlans.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledRenderFunction,
  CompiledValidationFunction,
} from './compiledPhaseResults.type'

export interface CompiledStep {
  runtimePlan: StepRuntimePlan
  navigationPlan: NavigationRuntimePlan
  compiledValidation?: CompiledValidationFunction
  compiledEntryValidation?: CompiledEntryValidationFunction
  compiledRender?: CompiledRenderFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction | undefined
}

export interface JourneyCompilationResult {
  readonly journeyCode: string
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeyPlans: Map<NodeId, JourneyRuntimePlan>
}

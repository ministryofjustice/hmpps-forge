import type { NodeId } from '../ast/ast.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../routing/routeDescriptors.type'
import type { JourneyRuntimePlan, NavigationRuntimePlan, StepRuntimePlan } from './runtimePlans.type'
import type { CompiledAccessLifecycleFunction, CompiledSubmitHooksFunction } from '../runtime/hookLifecycle.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledResolveFunction,
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../compiled/compiledFunctions.type'

export interface CompiledStep {
  runtimePlan: StepRuntimePlan
  navigationPlan: NavigationRuntimePlan
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
  compiledSubmitHooks?: CompiledSubmitHooksFunction
  compiledAnswerPreparation?: CompiledAnswerPreparationFunction
  compiledValidation?: CompiledValidationFunction
  compiledEntryValidation?: CompiledEntryValidationFunction
  compiledResolve?: CompiledResolveFunction
  compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
}

export interface CompiledJourney {
  runtimePlan: JourneyRuntimePlan
  navigationPlan: NavigationRuntimePlan
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
  compiledAnswerPreparation?: CompiledAnswerPreparationFunction
  compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
}

export interface JourneyCompilationResult {
  readonly journeyCode: string
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeys: Map<NodeId, CompiledJourney>
}

import type { NodeId } from '../ast/ast.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../routing/routeDescriptors.type'
import type { JourneyRuntimePlan, StepRuntimePlan } from './runtimePlans.type'
import type { CompiledAccessLifecycleFunction, CompiledSubmitHooksFunction } from '../runtime/hookLifecycle.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledReachabilityFactsFunction,
  CompiledReachabilityStateFunction,
  CompiledResolveFunction,
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../compiled/compiledFunctions.type'

export type CompiledPackageFunctions = Record<PropertyKey, never>

export interface CompiledJourneyFunctions {
  compiledReachabilityFacts: CompiledReachabilityFactsFunction
  compiledReachabilityState: CompiledReachabilityStateFunction
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle: CompiledAccessLifecycleFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction
  compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
}

export interface CompiledStepFunctions {
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle: CompiledAccessLifecycleFunction
  compiledSubmitHooks: CompiledSubmitHooksFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction
  compiledValidation: CompiledValidationFunction
  compiledEntryValidation: CompiledEntryValidationFunction
  compiledResolve: CompiledResolveFunction
}

export interface CompiledStep {
  runtimePlan: StepRuntimePlan
  compiledReachabilityFacts: CompiledReachabilityFactsFunction
  compiledReachabilityState: CompiledReachabilityStateFunction
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle: CompiledAccessLifecycleFunction
  compiledSubmitHooks: CompiledSubmitHooksFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction
  compiledValidation: CompiledValidationFunction
  compiledEntryValidation: CompiledEntryValidationFunction
  compiledResolve: CompiledResolveFunction
  compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
}

export interface CompiledJourney {
  runtimePlan: JourneyRuntimePlan
  compiledReachabilityFacts: CompiledReachabilityFactsFunction
  compiledReachabilityState: CompiledReachabilityStateFunction
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle: CompiledAccessLifecycleFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction
  compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
}

export interface CompiledPackage {
  readonly journeyCode: string
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeys: Map<NodeId, CompiledJourney>
}

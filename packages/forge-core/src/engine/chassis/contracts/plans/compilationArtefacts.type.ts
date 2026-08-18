import type { NodeId } from '../ast/ast.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../../../concerns/route/contracts/routeDescriptors.type'
import type { JourneyMountInfo, StepMountInfo } from './mountInfo.type'
import type { CompiledFieldInventoryFunction } from '../../../concerns/answer-cleardown/contracts/compiledFieldInventory.type'
import type {
  CompiledAccessLifecycleFunction,
  CompiledSubmitHooksFunction,
} from '../../../concerns/hooks/contracts/hookLifecycle.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledReachabilityFactsFunction,
  CompiledReachabilityStateFunction,
  CompiledResolveFunction,
  CompiledRouteMetadataFunction,
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../compiled/compiledFunctions.type'

export interface CompiledPackageFunctions {
  compiledRouteMetadata: CompiledRouteMetadataFunction
}

export interface CompiledJourneyFunctions {
  compiledReachabilityFacts: CompiledReachabilityFactsFunction
  compiledReachabilityState: CompiledReachabilityStateFunction
  compiledFieldInventory: CompiledFieldInventoryFunction | undefined
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
  mountInfo: StepMountInfo
  compiledReachabilityFacts: CompiledReachabilityFactsFunction
  compiledReachabilityState: CompiledReachabilityStateFunction
  compiledFieldInventory: CompiledFieldInventoryFunction | undefined
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle: CompiledAccessLifecycleFunction
  compiledSubmitHooks: CompiledSubmitHooksFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction
  compiledValidation: CompiledValidationFunction
  compiledEntryValidation: CompiledEntryValidationFunction
  compiledResolve: CompiledResolveFunction
  compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
  compiledRouteMetadata: CompiledRouteMetadataFunction
}

export interface CompiledJourney {
  mountInfo: JourneyMountInfo
  compiledReachabilityFacts: CompiledReachabilityFactsFunction
  compiledReachabilityState: CompiledReachabilityStateFunction
  compiledFieldInventory: CompiledFieldInventoryFunction | undefined
  compiledStaticData: CompiledStaticDataFunction
  compiledAccessLifecycle: CompiledAccessLifecycleFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction
  compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
  compiledRouteMetadata: CompiledRouteMetadataFunction
}

export interface CompiledPackage {
  readonly journeyCode: string
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeys: Map<NodeId, CompiledJourney>
}

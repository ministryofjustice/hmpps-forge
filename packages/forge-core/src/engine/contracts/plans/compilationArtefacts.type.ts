import type { NodeId } from '../ast/ast.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../routing/routeDescriptors.type'
import type { JourneyRuntimePlan, NavigationRuntimePlan, StepRuntimePlan } from './runtimePlans.type'
import type { CompiledAccessLifecycleFunction, CompiledSubmitHooksFunction } from '../runtime/hookLifecycle.type'
import type {
  CompiledDomainValidationFunction,
  CompiledEntryValidationFunction,
  CompiledFieldAnswerPreparationFunction,
  CompiledFieldValidationFunction,
  CompiledIteratorFieldAnswerPreparationFunction,
  CompiledIteratorFieldValidationFunction,
  CompiledIteratorInputFunction,
  CompiledRenderFunction,
} from '../compiled/compiledFunctions.type'

export interface FieldValidationEntry {
  readonly nodeId: NodeId
  readonly validate: CompiledFieldValidationFunction
}

export interface IteratorFieldValidationEntry {
  readonly templateNodeId: string
  readonly validate: CompiledIteratorFieldValidationFunction
}

export interface IteratorValidationGroup {
  readonly nodeId: NodeId
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly IteratorFieldValidationEntry[]
}

export interface ValidationPlan {
  readonly fields: readonly FieldValidationEntry[]
  readonly iteratorGroups: readonly IteratorValidationGroup[]
  readonly domain?: CompiledDomainValidationFunction
}

export interface FieldAnswerPreparationEntry {
  readonly nodeId: NodeId
  readonly prepare: CompiledFieldAnswerPreparationFunction
}

export interface IteratorFieldAnswerPreparationEntry {
  readonly templateNodeId: string
  readonly prepare: CompiledIteratorFieldAnswerPreparationFunction
}

export interface IteratorAnswerPreparationGroup {
  readonly nodeId: NodeId
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly IteratorFieldAnswerPreparationEntry[]
}

export interface AnswerPreparationPlan {
  readonly fields: readonly FieldAnswerPreparationEntry[]
  readonly iteratorGroups: readonly IteratorAnswerPreparationGroup[]
}

export interface CompiledStep {
  runtimePlan: StepRuntimePlan
  navigationPlan: NavigationRuntimePlan
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
  compiledSubmitHooks?: CompiledSubmitHooksFunction
  compiledEntryValidation?: CompiledEntryValidationFunction
  compiledRender?: CompiledRenderFunction
  validationPlan?: ValidationPlan
  answerPreparationPlan: AnswerPreparationPlan
}

export interface CompiledJourney {
  runtimePlan: JourneyRuntimePlan
  navigationPlan: NavigationRuntimePlan
  compiledAccessLifecycle?: CompiledAccessLifecycleFunction
  answerPreparationPlan: AnswerPreparationPlan
}

export interface JourneyCompilationResult {
  readonly journeyCode: string
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeys: Map<NodeId, CompiledJourney>
}

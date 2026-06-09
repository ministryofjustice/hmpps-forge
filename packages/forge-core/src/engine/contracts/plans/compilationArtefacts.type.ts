import type { NodeId } from '../ast/ast.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../routing/routeDescriptors.type'
import type { JourneyRuntimePlan, NavigationRuntimePlan, StepRuntimePlan } from './runtimePlans.type'
import type { CompiledAccessHookFunction, CompiledSubmitHookFunction } from '../runtime/hookLifecycle.type'
import type {
  CompiledAncestorMetadataFunction,
  CompiledDomainValidationFunction,
  CompiledEntryValidationRuleFunction,
  CompiledFieldAnswerPreparationFunction,
  CompiledFieldValidationFunction,
  CompiledIteratorFieldAnswerPreparationFunction,
  CompiledIteratorFieldValidationFunction,
  CompiledIteratorInputFunction,
  CompiledIteratorRenderBlockFunction,
  CompiledRenderBlockFunction,
  CompiledStepMetadataFunction,
} from '../compiled/compiledFunctions.type'

export interface FieldValidationEntry {
  readonly validate: CompiledFieldValidationFunction
}

export interface IteratorFieldValidationEntry {
  readonly validate: CompiledIteratorFieldValidationFunction
}

export interface IteratorValidationGroup {
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly IteratorFieldValidationEntry[]
}

export interface ValidationPlan {
  readonly fields: readonly FieldValidationEntry[]
  readonly iteratorGroups: readonly IteratorValidationGroup[]
  readonly domain?: CompiledDomainValidationFunction
}

export interface FieldAnswerPreparationEntry {
  readonly prepare: CompiledFieldAnswerPreparationFunction
}

export interface IteratorFieldAnswerPreparationEntry {
  readonly prepare: CompiledIteratorFieldAnswerPreparationFunction
}

export interface IteratorAnswerPreparationGroup {
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly IteratorFieldAnswerPreparationEntry[]
}

export interface AnswerPreparationPlan {
  readonly fields: readonly FieldAnswerPreparationEntry[]
  readonly iteratorGroups: readonly IteratorAnswerPreparationGroup[]
}

export interface RenderBlockEntry {
  readonly render: CompiledRenderBlockFunction
}

export interface IteratorRenderBlockEntry {
  readonly render: CompiledIteratorRenderBlockFunction
}

export interface IteratorRenderBlockGroup {
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly blocks: readonly IteratorRenderBlockEntry[]
}

export interface RenderPlan {
  readonly compiledStepMetadata?: CompiledStepMetadataFunction
  readonly compiledAncestorMetadata?: CompiledAncestorMetadataFunction
  readonly blocks: readonly RenderBlockEntry[]
  readonly iteratorGroups: readonly IteratorRenderBlockGroup[]
}

export interface EntryValidationRule {
  readonly groups: readonly string[]
  readonly evaluate?: CompiledEntryValidationRuleFunction
}

export interface EntryValidationPlan {
  readonly rules: readonly EntryValidationRule[]
}

export interface AccessHookEntry {
  readonly evaluate: CompiledAccessHookFunction
}

export interface AccessLifecyclePlan {
  readonly hooks: readonly AccessHookEntry[]
}

export interface SubmitHookEntry {
  readonly evaluate: CompiledSubmitHookFunction
}

export interface SubmitLifecyclePlan {
  readonly hooks: readonly SubmitHookEntry[]
}

export interface CompiledStep {
  runtimePlan: StepRuntimePlan
  navigationPlan: NavigationRuntimePlan
  accessLifecyclePlan?: AccessLifecyclePlan
  submitLifecyclePlan?: SubmitLifecyclePlan
  entryValidationPlan?: EntryValidationPlan
  renderPlan?: RenderPlan
  validationPlan?: ValidationPlan
  answerPreparationPlan: AnswerPreparationPlan
}

export interface CompiledJourney {
  runtimePlan: JourneyRuntimePlan
  navigationPlan: NavigationRuntimePlan
  accessLifecyclePlan?: AccessLifecyclePlan
  answerPreparationPlan: AnswerPreparationPlan
}

export interface JourneyCompilationResult {
  readonly journeyCode: string
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeys: Map<NodeId, CompiledJourney>
}

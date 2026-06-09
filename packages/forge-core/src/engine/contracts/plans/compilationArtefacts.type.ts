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

/** One compiled validation function for a single non-iterator field. */
export interface FieldValidationEntry {
  readonly validate: CompiledFieldValidationFunction
}

/** One compiled validation function for a field inside an iterator, invoked once per item scope. */
export interface IteratorFieldValidationEntry {
  readonly validate: CompiledIteratorFieldValidationFunction
}

/**
 * A MAP iterator's validation work: `evaluateInput` expands the collection into
 * per-item scopes, then every entry in `fields` runs once for each scope.
 */
export interface IteratorValidationGroup {
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly IteratorFieldValidationEntry[]
}

/**
 * All validation for one step or journey: a flat list of plain field validators,
 * the iterator groups whose fields validate per item, and an optional domain
 * validator that runs cross-field checks over the whole step.
 */
export interface ValidationPlan {
  readonly fields: readonly FieldValidationEntry[]
  readonly iteratorGroups: readonly IteratorValidationGroup[]
  readonly domain?: CompiledDomainValidationFunction
}

/**
 * One compiled prepare function for a single non-iterator field. Formats the
 * field's submitted or default answer and mutates `ctx.answers` in place.
 */
export interface FieldAnswerPreparationEntry {
  readonly prepare: CompiledFieldAnswerPreparationFunction
}

/**
 * One compiled prepare function for a field inside an iterator, invoked once per
 * item scope; mutates `ctx.answers` in place for that item.
 */
export interface IteratorFieldAnswerPreparationEntry {
  readonly prepare: CompiledIteratorFieldAnswerPreparationFunction
}

/**
 * A MAP iterator's answer-preparation work: `evaluateInput` expands the
 * collection into per-item scopes, then every prepare entry runs once per scope.
 */
export interface IteratorAnswerPreparationGroup {
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly IteratorFieldAnswerPreparationEntry[]
}

/**
 * All answer preparation for one step or journey. Each entry formats one field's
 * answer and mutates `ctx.answers` in place; iterator groups prepare per item.
 */
export interface AnswerPreparationPlan {
  readonly fields: readonly FieldAnswerPreparationEntry[]
  readonly iteratorGroups: readonly IteratorAnswerPreparationGroup[]
}

/** One compiled function producing a single RenderBlock for a non-iterator block. */
export interface RenderBlockEntry {
  readonly render: CompiledRenderBlockFunction
}

/**
 * One compiled render function for a block inside an iterator, invoked once per
 * item scope; may yield a single RenderBlock or an array of them.
 */
export interface IteratorRenderBlockEntry {
  readonly render: CompiledIteratorRenderBlockFunction
}

/**
 * A MAP iterator's render work: `evaluateInput` expands the collection into
 * per-item scopes, then every block entry renders once per scope.
 */
export interface IteratorRenderBlockGroup {
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly blocks: readonly IteratorRenderBlockEntry[]
}

/**
 * Everything needed to render one step: optional functions producing step and
 * ancestor metadata, the flat list of block renderers, and iterator groups whose
 * blocks render per item.
 */
export interface RenderPlan {
  readonly compiledStepMetadata?: CompiledStepMetadataFunction
  readonly compiledAncestorMetadata?: CompiledAncestorMetadataFunction
  readonly blocks: readonly RenderBlockEntry[]
  readonly iteratorGroups: readonly IteratorRenderBlockGroup[]
}

/**
 * A GET-entry rule selecting which validation groups run on entry: when
 * `evaluate` is absent the `groups` always apply; otherwise they apply only if
 * the predicate returns true. `groups` are validation group identifiers.
 */
export interface EntryValidationRule {
  readonly groups: readonly string[]
  readonly evaluate?: CompiledEntryValidationRuleFunction
}

/** The set of rules deciding which validation groups run when a step is entered via GET. */
export interface EntryValidationPlan {
  readonly rules: readonly EntryValidationRule[]
}

/** One compiled access hook, run during the access-lifecycle phase. */
export interface AccessHookEntry {
  readonly evaluate: CompiledAccessHookFunction
}

/** The access hooks for a step or journey, run in order during the access-lifecycle phase. */
export interface AccessLifecyclePlan {
  readonly hooks: readonly AccessHookEntry[]
}

/** One compiled submit hook, run during the submit phase of a POST step. */
export interface SubmitHookEntry {
  readonly evaluate: CompiledSubmitHookFunction
}

/** The submit hooks for a step, run in order during the submit phase of a POST. */
export interface SubmitLifecyclePlan {
  readonly hooks: readonly SubmitHookEntry[]
}

/**
 * The fully compiled artefacts for one step: its runtime/navigation plans plus
 * the per-phase plans the runtime executes. Phase plans are optional because a
 * step may declare no work for that phase (e.g. no submit hooks on a GET-only
 * step); the answer-preparation plan is always present.
 */
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

/**
 * The compiled artefacts for a journey-root request, which runs only access and
 * answer-preparation before a redirect terminal — hence no render, validation,
 * entry-validation, or submit plans.
 */
export interface CompiledJourney {
  runtimePlan: JourneyRuntimePlan
  navigationPlan: NavigationRuntimePlan
  accessLifecyclePlan?: AccessLifecyclePlan
  answerPreparationPlan: AnswerPreparationPlan
}

/**
 * The complete output of compiling a journey: the journey's author-assigned code
 * that scopes its route keys, route indices for resolving requests to nodes, and
 * the compiled steps and journeys keyed by NodeId — one artefact per step node and
 * per journey node. Fields, blocks, and hooks shared across those steps are
 * compiled once and reused inside the per-step plans.
 */
export interface JourneyCompilationResult {
  readonly journeyCode: string
  readonly stepRouteIndex: StepRouteIndex
  readonly journeyRouteIndex: JourneyRouteIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeys: Map<NodeId, CompiledJourney>
}

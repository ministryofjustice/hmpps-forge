import type { NodeId, TemplateNodeId } from '../ast/ast.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../routing/routeDescriptors.type'
import type { NavigationRuntimePlan, RuntimePlan } from './runtimePlans.type'
import type {
  CompiledAccessHookFunction,
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
  CompiledSubmitHookFunction,
} from '../compiled/compiledFunctions.type'

/**
 * One compiled validation function for a single non-iterator field. `nodeId`
 * identifies the field block so the runtime can attribute the verdict in the
 * request trace.
 */
export interface CompiledFieldValidation {
  readonly nodeId: NodeId
  readonly validate: CompiledFieldValidationFunction
}

/** One compiled validation function for a field inside an iterator, invoked once per item scope. */
export interface CompiledIteratorFieldValidation {
  readonly nodeId: TemplateNodeId
  readonly validate: CompiledIteratorFieldValidationFunction
}

/**
 * A MAP iterator's validation work: `evaluateInput` expands the collection into
 * per-item scopes, then every entry in `fields` runs once for each scope.
 * `nodeId` identifies the iterate node for trace attribution.
 */
export interface IteratorValidationGroup {
  readonly nodeId: NodeId
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly CompiledIteratorFieldValidation[]
}

/**
 * All validation for one step or journey: a flat list of plain field validators,
 * the iterator groups whose fields validate per item, and an optional domain
 * validator that runs cross-field checks over the whole step.
 */
export interface ValidationPlan {
  readonly fieldValidations: readonly CompiledFieldValidation[]
  readonly iteratorValidationGroups: readonly IteratorValidationGroup[]
  readonly domain?: CompiledDomainValidationFunction
}

/**
 * One compiled prepare function for a single non-iterator field. Formats the
 * field's submitted or default answer and mutates `ctx.answers` in place.
 * `nodeId` identifies the field block so the runtime can attribute the decision
 * in the request trace.
 */
export interface CompiledFieldAnswerPreparation {
  readonly nodeId: NodeId
  readonly prepare: CompiledFieldAnswerPreparationFunction
}

/**
 * One compiled prepare function for a field inside an iterator, invoked once per
 * item scope; mutates `ctx.answers` in place for that item.
 */
export interface CompiledIteratorFieldAnswerPreparation {
  readonly nodeId: TemplateNodeId
  readonly prepare: CompiledIteratorFieldAnswerPreparationFunction
}

/**
 * A MAP iterator's answer-preparation work: `evaluateInput` expands the
 * collection into per-item scopes, then every prepare entry runs once per scope.
 * `nodeId` identifies the iterate node for trace attribution.
 */
export interface IteratorAnswerPreparationGroup {
  readonly nodeId: NodeId
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly fields: readonly CompiledIteratorFieldAnswerPreparation[]
}

/**
 * All answer preparation for one step or journey. Each entry formats one field's
 * answer and mutates `ctx.answers` in place; iterator groups prepare per item.
 */
export interface AnswerPreparationPlan {
  readonly fieldAnswerPreparations: readonly CompiledFieldAnswerPreparation[]
  readonly iteratorAnswerPreparationGroups: readonly IteratorAnswerPreparationGroup[]
}

/**
 * One compiled function producing a single RenderBlock for a non-iterator block.
 * `nodeId` identifies the block so the runtime can attribute the evaluation in
 * the request trace.
 */
export interface CompiledRenderBlock {
  readonly nodeId: NodeId
  readonly variant: string
  readonly render: CompiledRenderBlockFunction
}

/**
 * One compiled render function for a block inside an iterator, invoked once per
 * item scope; may yield a single RenderBlock or an array of them.
 */
export interface CompiledIteratorRenderBlock {
  readonly nodeId: TemplateNodeId
  readonly variant: string
  readonly render: CompiledIteratorRenderBlockFunction
}

/**
 * A MAP iterator's render work: `evaluateInput` expands the collection into
 * per-item scopes, then every block entry renders once per scope. `nodeId`
 * identifies the iterate node for trace attribution.
 */
export interface IteratorRenderBlockGroup {
  readonly nodeId: NodeId
  readonly evaluateInput: CompiledIteratorInputFunction
  readonly blocks: readonly CompiledIteratorRenderBlock[]
}

/**
 * Everything needed to render one step: optional functions producing step and
 * ancestor metadata, the flat list of block renderers, and iterator groups whose
 * blocks render per item.
 */
export interface RenderPlan {
  readonly compiledStepMetadata?: CompiledStepMetadataFunction
  readonly compiledAncestorMetadata?: CompiledAncestorMetadataFunction
  readonly renderBlocks: readonly CompiledRenderBlock[]
  readonly iteratorRenderBlockGroups: readonly IteratorRenderBlockGroup[]
}

/**
 * A GET-entry rule selecting which validation groups run on entry: when
 * `evaluate` is absent the `groups` always apply; otherwise they apply only if
 * the predicate returns true. `groups` are validation group identifiers.
 * `nodeId` identifies the authored clause so the runtime can attribute the
 * decision in the request trace.
 */
export interface CompiledEntryValidationRule {
  readonly nodeId: NodeId
  readonly groups: readonly string[]
  readonly evaluate?: CompiledEntryValidationRuleFunction
}

/** The set of rules deciding which validation groups run when a step is entered via GET. */
export interface EntryValidationPlan {
  readonly entryValidationRules: readonly CompiledEntryValidationRule[]
}

/**
 * One compiled access hook, run during the access-lifecycle phase. `nodeId`
 * identifies the hook node so the runtime can attribute the decision in the
 * request trace.
 */
export interface CompiledAccessHook {
  readonly nodeId: NodeId
  readonly evaluate: CompiledAccessHookFunction
}

/** The access hooks for a step or journey, run in order during the access-lifecycle phase. */
export interface AccessLifecyclePlan {
  readonly accessHooks: readonly CompiledAccessHook[]
}

/**
 * One compiled submit hook, run during the submit-lifecycle phase of a POST
 * step. `nodeId` identifies the hook node so the runtime can attribute the
 * decision in the request trace.
 */
export interface CompiledSubmitHook {
  readonly nodeId: NodeId
  readonly evaluate: CompiledSubmitHookFunction
}

/** The submit hooks for a step, run in order during the submit-lifecycle phase of a POST. */
export interface SubmitLifecyclePlan {
  readonly submitHooks: readonly CompiledSubmitHook[]
}

/**
 * The fully compiled artefacts for one step: its runtime/navigation plans plus
 * the per-phase plans the runtime executes. Every phase plan is always present;
 * a step that declares no work for a phase gets an empty plan, which the
 * phase's walk runs through as a no-op.
 */
export interface CompiledStep {
  runtimePlan: RuntimePlan
  navigationPlan: NavigationRuntimePlan
  accessLifecyclePlan: AccessLifecyclePlan
  submitLifecyclePlan: SubmitLifecyclePlan
  entryValidationPlan: EntryValidationPlan
  renderPlan: RenderPlan
  validationPlan: ValidationPlan
  answerPreparationPlan: AnswerPreparationPlan
}

/**
 * The compiled artefacts for a journey-root request, which runs only access and
 * answer-preparation before a redirect terminal — hence no render, validation,
 * entry-validation, or submit plans.
 */
export interface CompiledJourney {
  runtimePlan: RuntimePlan
  navigationPlan: NavigationRuntimePlan
  accessLifecyclePlan: AccessLifecyclePlan
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

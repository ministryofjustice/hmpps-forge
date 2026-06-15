import type { NodeId, TemplateNodeId } from '../ast/ast.type'
import type { DomainValidationFailure, StepValidationFailure } from '../runtime/evaluationState.type'
import type { ResumeOutcome } from '../navigation/navigationEvaluation.type'

/**
 * One field's validation verdict: recorded for every field the validation plan
 * runs, passes included. `itemIndex` is present when the field validated inside
 * an iterator item.
 */
export interface FieldValidationTraceUnit {
  readonly kind: 'field-validation'
  readonly nodeId: NodeId | TemplateNodeId
  readonly itemIndex?: number
  readonly isValid: boolean
  readonly failures: readonly StepValidationFailure[]
  readonly durationMs: number
}

/** One MAP iterator's input expansion: how many item scopes the collection produced. */
export interface IteratorInputTraceUnit {
  readonly kind: 'iterator-input'
  readonly nodeId: NodeId
  readonly itemCount: number
  readonly durationMs: number
}

/** The step-level domain validation verdict (cross-field rules). */
export interface DomainValidationTraceUnit {
  readonly kind: 'domain-validation'
  readonly isValid: boolean
  readonly failures: readonly DomainValidationFailure[]
  readonly durationMs: number
}

/**
 * One field's answer preparation: recorded for every prepare the plan runs. The
 * prepare's effect lives in the shared answer history on the request context
 * rather than in the unit — what is recorded is that the field prepared, and
 * how long it took. `itemIndex` is present when the field prepared inside an
 * iterator item.
 */
export interface AnswerPreparationFieldTraceUnit {
  readonly kind: 'answer-preparation-field'
  readonly nodeId: NodeId | TemplateNodeId
  readonly itemIndex?: number
  readonly durationMs: number
}

/**
 * One access hook's run: recorded for every hook the access-lifecycle walk
 * executes, in run order. `outcome` is the hook's own verdict — a 'redirect'
 * or 'error' halts the phase, so hooks after a halting one never ran and are
 * absent. `redirect` carries the target and `status`/`message` the error
 * payload when the hook halted.
 */
export interface AccessHookTraceUnit {
  readonly kind: 'access-hook'
  readonly nodeId: NodeId
  readonly outcome: 'continue' | 'redirect' | 'error'
  readonly redirect?: string
  readonly status?: number
  readonly message?: string
  readonly durationMs: number
  readonly children?: readonly TraceUnit[]
}

/**
 * One submit hook's evaluation: recorded for every hook the submit-lifecycle
 * walk evaluates, in declared order. `executed: false` means the hook's
 * when/guards predicates skipped it and the walk moved on; the first executed
 * hook short-circuits the walk, so hooks after it never ran and are absent.
 * `validated` records whether the hook ran on-demand validation (whose units
 * are recorded alongside this one). `redirect` carries the target and
 * `status`/`message` the error payload when the executed hook halted.
 */
export interface SubmitHookTraceUnit {
  readonly kind: 'submit-hook'
  readonly nodeId: NodeId
  readonly executed: boolean
  readonly validated: boolean
  readonly outcome: 'continue' | 'redirect' | 'error'
  readonly redirect?: string
  readonly status?: number
  readonly message?: string
  readonly durationMs: number
  readonly children?: readonly TraceUnit[]
}

/** One async registered function invocation. */
export interface AsyncFunctionTraceUnit {
  readonly kind: 'async-function'
  readonly name: string
  readonly durationMs: number
}

/**
 * One entry-validation rule's verdict: recorded for every rule the plan holds
 * when a step is entered via GET. `active` is whether the rule's `when`
 * predicate passed (a rule with no predicate is always active); `groups` are
 * the validation groups the rule contributes when active.
 */
export interface EntryValidationRuleTraceUnit {
  readonly kind: 'entry-validation-rule'
  readonly nodeId: NodeId
  readonly active: boolean
  readonly groups: readonly string[]
  readonly durationMs: number
}

/**
 * One journey step's navigation state, recorded for every step the navigation
 * evaluation considered, in declaration order. Together the units describe the
 * journey's navigation graph for this request: `routeTemplatePath` is the
 * step's node identity for edge references, `declaredForwardRouteTemplatePaths`
 * are every authored forward edge (conditions ignored), and
 * `forwardRouteTemplatePaths` are the edges active for this request given the
 * user's answers and validation. `isReachable` is the graph walk's conclusion;
 * `isValid` is how the walk treated the step's validation — a step whose
 * validation failed does not activate its forward edges, which is why steps
 * after it can be unreachable (steps without validation, or never reached by
 * the walk, are treated as valid). The verdicts come out of one whole-journey
 * evaluation, so step units carry no individual timing; the evaluation's
 * duration is on the resolution unit.
 */
export interface NavigationStepTraceUnit {
  readonly kind: 'navigation-step'
  readonly nodeId: NodeId
  readonly routeTemplatePath: string
  readonly code?: string
  readonly isEntryPoint: boolean
  readonly isConditionalEntry: boolean
  readonly hasValidation: boolean
  readonly isReachable: boolean
  readonly isValid: boolean
  readonly forwardRouteTemplatePaths: readonly string[]
  readonly declaredForwardRouteTemplatePaths?: readonly string[]
  readonly predecessorRouteTemplatePaths: readonly string[]
}

/**
 * The navigation evaluation's conclusion: whether resume wants to move the
 * user, and the redirect target navigation resolved — absent when navigation
 * let the request continue. `currentStepNodeId` is the step being requested
 * (absent on a journey root), `canonicalPathRouteTemplatePaths` is the walked
 * path from entry to frontier, and the entry/frontier paths locate the
 * journey's start and furthest-progress steps in the step units' graph.
 * `durationMs` times the compiled navigation evaluation that produced the
 * step verdicts.
 */
export interface NavigationResolutionTraceUnit {
  readonly kind: 'navigation-resolution'
  readonly currentStepNodeId?: NodeId
  readonly defaultEntryRouteTemplatePath?: string
  readonly frontierRouteTemplatePath?: string
  readonly canonicalPathRouteTemplatePaths: readonly string[]
  readonly resumeActive: boolean
  readonly resumeOutcome: ResumeOutcome
  readonly redirect?: string
  readonly durationMs: number
}

/**
 * One compiled render block function's evaluation: recorded for every block
 * the render plan runs. `itemIndex` is present when the block evaluated inside
 * an iterator item. `properties` carries the evaluated property bag when trace
 * verbosity includes block output.
 */
export interface BlockEvaluationTraceUnit {
  readonly kind: 'block-evaluation'
  readonly nodeId: NodeId | TemplateNodeId
  readonly variant?: string
  readonly itemIndex?: number
  readonly properties?: Record<string, unknown>
  readonly durationMs: number
}

/**
 * One block's host render: recorded for every block the render-output walk
 * drives through the renderer, nested blocks included. Children render during
 * their parent's property transformation, so child units precede their parent's
 * and each duration covers only that block's own host render.
 */
export interface BlockRenderTraceUnit {
  readonly kind: 'block-render'
  readonly nodeId: NodeId
  readonly variant: string
  readonly durationMs: number
  readonly children?: readonly BlockRenderTraceUnit[]
}

/** The host renderer's page assembly: rendering the full page template from pre-rendered blocks. */
export interface PageAssemblyTraceUnit {
  readonly kind: 'page-assembly'
  readonly durationMs: number
}

/**
 * One sample of the full evaluation-context state, recorded at a labelled
 * point in the request: `initial` (before the first phase runs), a phase name
 * (state at that phase's end, recorded for halted phases too), or
 * `access-hook:<nodeId>` / `submit-hook:<nodeId>` (state right after that
 * hook ran). Values are tolerant deep copies: non-serializable values are
 * replaced with labels (`[Function: name]`, `[Circular]`,
 * `[Unserializable: TypeName]`), so every field is `unknown`-shaped rather
 * than its live runtime type. Carries no `durationMs` — a snapshot is a
 * sample, not work.
 */
export interface ContextSnapshotTraceUnit {
  readonly kind: 'context-snapshot'
  readonly point: string
  readonly request: {
    readonly params: Record<string, unknown>
    readonly query: Record<string, unknown>
    readonly post: Record<string, unknown>
    readonly headers: Record<string, unknown>
    readonly cookies: Record<string, unknown>
    readonly session: unknown
    readonly state: Record<string, unknown>
  }
  readonly answers: Record<string, unknown>
  readonly data: Record<string, unknown>
  readonly validation?: unknown
  readonly reachability?: unknown
  readonly fieldsToClear?: readonly string[]
  readonly response: {
    readonly headers: Record<string, unknown>
    readonly cookies: Record<string, unknown>
  }
}

/**
 * One MAP iterator root's materialisation: how many items the collection
 * expanded to and how many concrete template nodes were produced.
 */
export interface TemplateMaterialisationTraceUnit {
  readonly kind: 'template-materialisation'
  readonly nodeId: NodeId
  readonly itemCount: number
  readonly nodeCount: number
  readonly durationMs: number
}

/**
 * One recorded decision from walking a phase plan. The union grows as phases
 * gain trace coverage; consumers must switch on `kind` and ignore kinds they
 * do not recognise.
 */
export type TraceUnit =
  | FieldValidationTraceUnit
  | IteratorInputTraceUnit
  | DomainValidationTraceUnit
  | AnswerPreparationFieldTraceUnit
  | AccessHookTraceUnit
  | SubmitHookTraceUnit
  | AsyncFunctionTraceUnit
  | EntryValidationRuleTraceUnit
  | NavigationStepTraceUnit
  | NavigationResolutionTraceUnit
  | BlockEvaluationTraceUnit
  | BlockRenderTraceUnit
  | PageAssemblyTraceUnit
  | ContextSnapshotTraceUnit
  | TemplateMaterialisationTraceUnit

/**
 * How a phase concluded: a pipeline phase continues or halts, the terminal
 * produces the result kind, and `error` marks a phase that threw.
 */
export type PhaseTraceOutcome = 'continue' | 'halt-redirect' | 'halt-error' | 'render' | 'redirect' | 'error'

/** One pipeline phase's record: its name, conclusion, and every decision made inside it. */
export interface PhaseTrace {
  readonly phase: string
  readonly outcome: PhaseTraceOutcome
  readonly durationMs: number
  readonly units: readonly TraceUnit[]
}

/** How the whole request concluded. */
export type RequestTraceOutcome = 'render' | 'redirect' | 'error'

/**
 * The full decision log for one request: every phase the orchestrator ran, in
 * order, each carrying the per-unit decisions recorded while walking its plan.
 *
 * Traces leave the engine through the orchestrator's `TraceObserver` — by
 * default the `forge:request:complete` diagnostics-channel publisher.
 */
export interface RequestTrace {
  readonly outcome: RequestTraceOutcome
  readonly durationMs: number
  readonly phases: readonly PhaseTrace[]
}

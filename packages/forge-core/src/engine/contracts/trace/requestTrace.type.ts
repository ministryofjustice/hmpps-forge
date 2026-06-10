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
export interface AnswerPreparationTraceUnit {
  readonly kind: 'answer-preparation'
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
 * One journey step's reachability verdict, recorded for every step the
 * navigation evaluation considered, in declaration order. `isReachable` is the
 * graph walk's conclusion; `isValid` is how the walk treated the step's
 * validation — a step whose validation failed does not activate its forward
 * edges, which is why steps after it can be unreachable (steps without
 * validation, or never reached by the walk, are treated as valid). The
 * verdicts come out of one whole-journey evaluation, so step units carry no
 * individual timing; the evaluation's duration is on the resolution unit.
 */
export interface NavigationStepTraceUnit {
  readonly kind: 'navigation-step'
  readonly nodeId: NodeId
  readonly isReachable: boolean
  readonly isValid: boolean
}

/**
 * The navigation evaluation's conclusion: whether resume wants to move the
 * user, and the redirect target navigation resolved — absent when navigation
 * let the request continue. `durationMs` times the compiled navigation
 * evaluation that produced the step verdicts.
 */
export interface NavigationResolutionTraceUnit {
  readonly kind: 'navigation-resolution'
  readonly resumeOutcome: ResumeOutcome
  readonly redirect?: string
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
  | AnswerPreparationTraceUnit
  | AccessHookTraceUnit
  | SubmitHookTraceUnit
  | EntryValidationRuleTraceUnit
  | NavigationStepTraceUnit
  | NavigationResolutionTraceUnit

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
 * How a trace leaves the engine is deliberately undecided — recording is being
 * rolled out across all phases first; the exposure mechanism comes after.
 */
export interface RequestTrace {
  readonly outcome: RequestTraceOutcome
  readonly durationMs: number
  readonly phases: readonly PhaseTrace[]
}

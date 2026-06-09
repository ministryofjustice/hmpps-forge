import type { NodeId, TemplateNodeId } from '../ast/ast.type'
import type { DomainValidationFailure, StepValidationFailure } from '../runtime/evaluationState.type'

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
 * One recorded decision from walking a phase plan. The union grows as phases
 * gain trace coverage; consumers must switch on `kind` and ignore kinds they
 * do not recognise.
 */
export type TraceUnit =
  | FieldValidationTraceUnit
  | IteratorInputTraceUnit
  | DomainValidationTraceUnit
  | AnswerPreparationTraceUnit

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

import type { SerializedTraceSpan } from '../../tracing/traceSpan.type'

/**
 * One compilation phase (for example DSL validation or code generation), with
 * its timing and the trace spans recorded while it ran.
 */
export interface CompilationTracePhase {
  readonly phase: string
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly units: readonly SerializedTraceSpan[]
}

/**
 * The failure that ended a compilation. Kept independent of the runtime request
 * error shape: compile errors have no HTTP status and diagnostics must not
 * depend on the contracts/runtime layer.
 */
export interface CompilationTraceError {
  readonly message: string
  readonly stack?: string
}

/**
 * A full compilation trace: overall outcome and timing plus the per-phase
 * breakdown of the work that ran.
 */
export interface CompilationTrace {
  readonly outcome: 'compiled' | 'error'
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly error?: CompilationTraceError
  readonly phases: readonly CompilationTracePhase[]
}

/**
 * A compilation trace paired with the journey it describes. `journeyCode` is
 * undefined when compilation fails before the AST — and so the journey code —
 * is available.
 */
export interface CompilationTraceEvent {
  readonly journeyCode?: string
  readonly trace: CompilationTrace
}

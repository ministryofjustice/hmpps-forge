import type {
  PhaseTrace,
  PhaseTraceOutcome,
  RequestTrace,
  RequestTraceOutcome,
  TraceUnit,
} from '../../../contracts/trace/requestTrace.type'

interface OpenPhase {
  readonly phase: string
  readonly startedAt: number
  readonly units: TraceUnit[]
}

/**
 * Accumulates one request's decision log. The orchestrator creates one per
 * traced request, opens and closes phases around each pipeline phase it runs,
 * and the phase evaluators record per-unit decisions into whichever phase is
 * open. `finish` seals the trace; a still-open phase (a phase that threw) is
 * closed with the finishing outcome.
 */
export default class TraceRecorder {
  private readonly startedAt = performance.now()

  private readonly phases: PhaseTrace[] = []

  private openPhase?: OpenPhase

  beginPhase(phase: string): void {
    this.openPhase = { phase, startedAt: performance.now(), units: [] }
  }

  endPhase(outcome: PhaseTraceOutcome): void {
    if (!this.openPhase) {
      return
    }

    this.phases.push({
      phase: this.openPhase.phase,
      outcome,
      durationMs: performance.now() - this.openPhase.startedAt,
      units: this.openPhase.units,
    })
    this.openPhase = undefined
  }

  record(unit: TraceUnit): void {
    this.openPhase?.units.push(unit)
  }

  finish(outcome: RequestTraceOutcome): RequestTrace {
    this.endPhase(outcome)

    return {
      outcome,
      durationMs: performance.now() - this.startedAt,
      phases: this.phases,
    }
  }
}

import type {
  PhaseTrace,
  PhaseTraceOutcome,
  RequestTrace,
  RequestTraceOutcome,
  TraceUnit,
} from '../../../contracts/trace/requestTrace.type'

type OmitDuration<T> = T extends { durationMs: number } ? Omit<T, 'durationMs'> : never
type OmitAutoFields<T> = T extends { durationMs: number } ? Omit<T, 'durationMs' | 'children'> : never
type MeasuredUnitFields = OmitDuration<TraceUnit>
type ScopedUnitFields = OmitAutoFields<TraceUnit>

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

  private readonly scopeStack: TraceUnit[][] = []

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
    if (this.scopeStack.length > 0) {
      this.scopeStack[this.scopeStack.length - 1].push(unit)
    } else {
      this.openPhase?.units.push(unit)
    }
  }

  beginScope(): void {
    this.scopeStack.push([])
  }

  endScope(): readonly TraceUnit[] {
    return this.scopeStack.pop() ?? []
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

export function measure<T>(trace: TraceRecorder | undefined, fields: MeasuredUnitFields, fn: () => T): T {
  const measuredAt = performance.now()
  const result = fn()

  trace?.record({ ...fields, durationMs: performance.now() - measuredAt } as TraceUnit)

  return result
}

export function measureScoped<T>(trace: TraceRecorder | undefined, fields: ScopedUnitFields, fn: () => T): T {
  trace?.beginScope()

  const measuredAt = performance.now()
  const result = fn()
  const children = trace?.endScope()

  trace?.record({
    ...fields,
    durationMs: performance.now() - measuredAt,
    ...(children && children.length > 0 ? { children } : {}),
  } as TraceUnit)

  return result
}

export function measureFrom<T>(
  trace: TraceRecorder | undefined,
  buildFields: (result: T) => MeasuredUnitFields,
  fn: () => T,
): T {
  const measuredAt = performance.now()
  const result = fn()

  trace?.record({ ...buildFields(result), durationMs: performance.now() - measuredAt } as TraceUnit)

  return result
}

export async function measureAsync<T>(
  trace: TraceRecorder | undefined,
  fields: MeasuredUnitFields,
  fn: () => T | Promise<T>,
): Promise<T> {
  const measuredAt = performance.now()
  const result = await fn()

  trace?.record({ ...fields, durationMs: performance.now() - measuredAt } as TraceUnit)

  return result
}

export async function measureAsyncFrom<T>(
  trace: TraceRecorder | undefined,
  buildFields: (result: T) => MeasuredUnitFields,
  fn: () => T | Promise<T>,
): Promise<T> {
  const measuredAt = performance.now()
  const result = await fn()

  trace?.record({ ...buildFields(result), durationMs: performance.now() - measuredAt } as TraceUnit)

  return result
}

export async function measureAsyncScopedFrom<T>(
  trace: TraceRecorder | undefined,
  buildFields: (result: T) => ScopedUnitFields,
  fn: () => T | Promise<T>,
): Promise<T> {
  trace?.beginScope()

  const measuredAt = performance.now()
  const result = await fn()
  const children = trace?.endScope()

  trace?.record({
    ...buildFields(result),
    durationMs: performance.now() - measuredAt,
    ...(children && children.length > 0 ? { children } : {}),
  } as TraceUnit)

  return result
}

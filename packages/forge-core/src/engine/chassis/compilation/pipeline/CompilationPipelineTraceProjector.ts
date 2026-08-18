import type TraceSpan from '../../tracing/TraceSpan'
import TraceSpanSerializer from '../../tracing/TraceSpanSerializer'
import type {
  CompilationTrace,
  CompilationTraceError,
  CompilationTracePhase,
} from '../../contracts/compilation/trace.type'
import type { ForgeInstrumentation } from '../../tracing/ForgeTraceSinkDispatcher'

export interface CompilationTraceEmission {
  readonly instrumentation: ForgeInstrumentation
  /** The `compilation.pipeline` root span the work executor produced, if compilation got far enough to have one. */
  readonly root: TraceSpan | undefined
  readonly journeyCode: string | undefined
  readonly outcome: 'compiled' | 'error'
  readonly error?: unknown
}

export default class CompilationPipelineTraceProjector {
  private readonly serializer = new TraceSpanSerializer()

  emit(emission: CompilationTraceEmission): void {
    const { instrumentation, root, journeyCode, outcome, error } = emission

    if (!instrumentation.enabled || root === undefined || root.children.length === 0) {
      return
    }

    // A failed compilation leaves the root span incomplete; close it here so
    // the emitted trace carries a duration either way.
    if (!root.completed) {
      root.complete(undefined)
    }

    const phases = this.project(root)

    instrumentation.onCompilationTrace({
      journeyCode,
      trace: { outcome, ...this.traceTiming(root), ...this.traceErrorDetail(outcome, error), phases },
    })
  }

  private project(root: TraceSpan): CompilationTracePhase[] {
    return root.children.map(phaseSpan => {
      const phase = this.phaseName(phaseSpan.kind)
      const units = phaseSpan.children
        .filter(child => !child.omitFromTrace)
        .map(child => this.serializer.serialize(child))

      return { phase, ...this.traceTiming(phaseSpan), units }
    })
  }

  private traceErrorDetail(outcome: 'compiled' | 'error', error: unknown): Pick<CompilationTrace, 'error'> {
    if (outcome !== 'error') {
      return {}
    }

    return { error: this.errorDetail(error) }
  }

  private errorDetail(error: unknown): CompilationTraceError {
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack }
    }

    return { message: String(error) }
  }

  private traceTiming(traceSpan: TraceSpan): Pick<CompilationTrace, 'startedAtMs' | 'completedAtMs' | 'durationMs'> {
    return {
      startedAtMs: traceSpan.startedAtMs,
      completedAtMs: traceSpan.completedAtMs,
      durationMs: traceSpan.durationMs,
    }
  }

  private phaseName(kind: string): string {
    const prefix = 'compilation.'

    return kind.startsWith(prefix) ? kind.slice(prefix.length) : kind
  }
}

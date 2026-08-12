import type TraceSpan from '../../tracing/TraceSpan'
import TraceSpanSerializer from '../../tracing/TraceSpanSerializer'
import type CompilationTracer from './CompilationTracer'
import type { CompilationTrace, CompilationTraceError, CompilationTracePhase } from './compilationTrace.type'
import type { ForgeInstrumentation } from '../../tracing/ForgeTraceSinkDispatcher'

export default class CompilationTraceProjector {
  private readonly serializer = new TraceSpanSerializer()

  emit(
    instrumentation: ForgeInstrumentation,
    tracer: CompilationTracer,
    outcome: 'compiled' | 'error',
    error?: unknown,
  ): void {
    const root = tracer.root

    if (!instrumentation.enabled || root === undefined || root.children.length === 0) {
      return
    }

    tracer.completeRoot()

    const phases = this.project(root)

    instrumentation.onCompilationTrace({
      journeyCode: tracer.journeyCode,
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

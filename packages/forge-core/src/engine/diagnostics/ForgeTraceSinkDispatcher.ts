import type { RequestTraceEvent } from '../contracts/runtime/trace.type'
import type { CompilationTraceEvent } from './tracing/compilationTrace.type'

export interface ForgeInstrumentationOptions {
  readonly sinks?: readonly ForgeInstrumentationSink[]

  /**
   * Attaches the generated JavaScript source to compilation trace spans.
   * Verbose, so opt-in. Default: false.
   */
  readonly captureGeneratedSource?: boolean
}

export interface ForgeInstrumentationSink {
  onRequestTrace(event: RequestTraceEvent): void
  onCompilationTrace?(event: CompilationTraceEvent): void
}

export interface ForgeInstrumentation {
  readonly enabled: boolean
  readonly captureGeneratedSource: boolean

  onRequestTrace(event: RequestTraceEvent): void
  onCompilationTrace(event: CompilationTraceEvent): void
}

export default class ForgeTraceSinkDispatcher implements ForgeInstrumentation {
  private readonly sinks: readonly ForgeInstrumentationSink[]

  private readonly captureGeneratedSourceOption: boolean

  constructor(options: ForgeInstrumentationOptions = {}) {
    this.sinks = options.sinks ?? []
    this.captureGeneratedSourceOption = options.captureGeneratedSource === true
  }

  get enabled(): boolean {
    return this.sinks.length > 0
  }

  get captureGeneratedSource(): boolean {
    return this.captureGeneratedSourceOption
  }

  onRequestTrace(event: RequestTraceEvent): void {
    this.sinks.forEach(sink => {
      sink.onRequestTrace(event)
    })
  }

  onCompilationTrace(event: CompilationTraceEvent): void {
    this.sinks.forEach(sink => {
      sink.onCompilationTrace?.(event)
    })
  }
}

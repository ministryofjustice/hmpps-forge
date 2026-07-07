// eslint-disable-next-line max-classes-per-file
import type { RequestTraceEvent } from '../contracts/runtime/trace.type'
import type { RequestSnapshot } from '../../framework/types/snapshot.type'
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

  /**
   * Per-request opt-in. When present, request tracing only runs when at least
   * one sink returns true for the request; sinks without it always want traces.
   * Decided once per request, and delivery is scoped to the accepting sinks.
   */
  shouldTrace?(snapshot: RequestSnapshot): boolean
}

export interface ForgeInstrumentation {
  readonly enabled: boolean
  readonly captureGeneratedSource: boolean

  /**
   * Resolves the sinks that want this request (shouldTrace, decided once at
   * request start) into an instrumentation view scoped to those sinks - its
   * `enabled` and `onRequestTrace` reflect only the accepting sinks.
   */
  forRequest(snapshot: RequestSnapshot): ForgeInstrumentation
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

  forRequest(snapshot: RequestSnapshot): ForgeInstrumentation {
    const acceptedSinks = this.sinks.filter(sink => sink.shouldTrace?.(snapshot) ?? true)

    return new RequestScopedInstrumentation(acceptedSinks, this.captureGeneratedSourceOption)
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

class RequestScopedInstrumentation implements ForgeInstrumentation {
  constructor(
    private readonly sinks: readonly ForgeInstrumentationSink[],
    private readonly captureGeneratedSourceOption: boolean,
  ) {}

  get enabled(): boolean {
    return this.sinks.length > 0
  }

  get captureGeneratedSource(): boolean {
    return this.captureGeneratedSourceOption
  }

  forRequest(): ForgeInstrumentation {
    return this
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

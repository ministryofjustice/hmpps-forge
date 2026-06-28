import type { RequestTraceEvent } from '../contracts/runtime/trace.type'

export interface ForgeInstrumentationOptions {
  readonly sinks?: readonly ForgeInstrumentationSink[]
}

export interface ForgeInstrumentationSink {
  onRequestTrace(event: RequestTraceEvent): void
}

export interface ForgeInstrumentation {
  readonly enabled: boolean

  onRequestTrace(event: RequestTraceEvent): void
}

export default class ForgeTraceSinkDispatcher implements ForgeInstrumentation {
  private readonly sinks: readonly ForgeInstrumentationSink[]

  constructor(options: ForgeInstrumentationOptions = {}) {
    this.sinks = options.sinks ?? []
  }

  get enabled(): boolean {
    return this.sinks.length > 0
  }

  onRequestTrace(event: RequestTraceEvent): void {
    this.sinks.forEach(sink => {
      sink.onRequestTrace(event)
    })
  }
}

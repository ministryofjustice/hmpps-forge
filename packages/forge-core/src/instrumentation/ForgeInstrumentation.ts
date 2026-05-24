import type { Logger } from '../framework/types/adapter.type'
import type { ForgeInstrumentationSink } from './types'

export interface ForgeInstrumentationOptions {
  sinks: ForgeInstrumentationSink | ForgeInstrumentationSink[]
}

// TODO: consider consolidating the logger into this class so all Forge output flows through instrumentation
export default class ForgeInstrumentation {
  private readonly sinks: ForgeInstrumentationSink[]

  constructor(options: ForgeInstrumentationOptions | undefined, logger: Logger | Console) {
    this.sinks = resolveSinks(options?.sinks)

    this.sinks.forEach(sink => {
      sink.initialize?.({ logger })
    })
  }

  record(trace: unknown): void {
    this.sinks.forEach(sink => {
      sink.record(trace)
    })
  }

  getSinks(): ForgeInstrumentationSink[] {
    return this.sinks
  }
}

function resolveSinks(sinks: ForgeInstrumentationOptions['sinks'] | undefined): ForgeInstrumentationSink[] {
  if (sinks === undefined) {
    return []
  }

  return Array.isArray(sinks) ? sinks : [sinks]
}

import type { Logger } from '../framework/types/adapter.type'
import LoggerSink from './LoggerSink'
import type { ForgeInstrumentationSink } from './types'

export interface ForgeInstrumentationOptions {
  sinks: ForgeInstrumentationSink | ForgeInstrumentationSink[]
}

export class ForgeInstrumentation {
  private readonly sinks: ForgeInstrumentationSink[]

  constructor(options: ForgeInstrumentationOptions | undefined, logger: Logger | Console) {
    this.sinks = [new LoggerSink(logger), ...resolveSinks(options?.sinks)]
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

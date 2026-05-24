import type { Logger } from '../framework/types/adapter.type'
import { ActiveSpan } from './ActiveSpan'
import LoggerSink from './LoggerSink'
import type { ForgeInstrumentationSink, ForgeSpan } from './types'

export interface ForgeInstrumentationOptions {
  sinks: ForgeInstrumentationSink | ForgeInstrumentationSink[]
}

export class ForgeInstrumentation {
  private readonly sinks: ForgeInstrumentationSink[]

  constructor(options: ForgeInstrumentationOptions | undefined, logger: Logger | Console) {
    this.sinks = [new LoggerSink(logger), ...resolveSinks(options?.sinks)]
  }

  startSpan(name: string): ActiveSpan {
    return new ActiveSpan(name, span => this.record(span))
  }

  record(span: ForgeSpan): void {
    this.sinks.forEach(sink => {
      sink.record(span)
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

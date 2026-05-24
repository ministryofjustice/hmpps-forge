import { randomUUID } from 'crypto'
import type { Logger } from '../framework/types/adapter.type'
import { ActiveSpan, type ClockAnchor } from './ActiveSpan'
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
    return this.createSpan(name)
  }

  record(span: ForgeSpan): void {
    this.sinks.forEach(sink => {
      sink.record(span)
    })
  }

  getSinks(): ForgeInstrumentationSink[] {
    return this.sinks
  }

  private createSpan(name: string, parentSpanId?: string, parentClockAnchor?: ClockAnchor): ActiveSpan {
    return new ActiveSpan({
      name,
      spanId: randomUUID(),
      parentSpanId,
      clockAnchor: parentClockAnchor,
      recorder: span => this.record(span),
      childFactory: (childName, childParentSpanId, childParentClockAnchor) =>
        this.createSpan(childName, childParentSpanId, childParentClockAnchor),
    })
  }
}

function resolveSinks(sinks: ForgeInstrumentationOptions['sinks'] | undefined): ForgeInstrumentationSink[] {
  if (sinks === undefined) {
    return []
  }

  return Array.isArray(sinks) ? sinks : [sinks]
}

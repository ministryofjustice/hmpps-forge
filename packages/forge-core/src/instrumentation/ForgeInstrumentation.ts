import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'
import type { Logger } from '../framework/types/adapter.type'
import { ActiveSpan } from './ActiveSpan'
import LoggerSink from './LoggerSink'
import type { ForgeInstrumentationSink, ForgeSpan } from './types'

export interface ForgeInstrumentationOptions {
  sinks: ForgeInstrumentationSink | ForgeInstrumentationSink[]
}

export interface ForgeInstrumentationForgeOptions {
  logger: Logger | Console
  strictRegistration: boolean
  instrumentation?: ForgeInstrumentationOptions
}

export class ForgeInstrumentation {
  private readonly sinks: ForgeInstrumentationSink[]

  private readonly contextStore = new AsyncLocalStorage<ActiveSpan>()

  constructor(forgeOptions: ForgeInstrumentationForgeOptions) {
    this.sinks = [new LoggerSink(forgeOptions), ...resolveSinks(forgeOptions.instrumentation?.sinks)]
  }

  span<T>(name: string, fn: (span: ActiveSpan) => T): T {
    const parent = this.contextStore.getStore()
    const span = this.createSpan(name, parent)

    return this.contextStore.run(span, () => span.traceFn(fn))
  }

  async spanAsync<T>(name: string, fn: (span: ActiveSpan) => Promise<T>): Promise<T> {
    const parent = this.contextStore.getStore()
    const span = this.createSpan(name, parent)

    return this.contextStore.run(span, () => span.traceAsyncFn(fn))
  }

  getCurrentSpan(): ActiveSpan | undefined {
    return this.contextStore.getStore()
  }

  startSpan(name: string): ActiveSpan {
    const parent = this.contextStore.getStore()

    return this.createSpan(name, parent)
  }

  record(span: ForgeSpan): void {
    this.sinks.forEach(sink => {
      sink.record(span)
    })
  }

  getSinks(): ForgeInstrumentationSink[] {
    return this.sinks
  }

  private createSpan(name: string, parent?: ActiveSpan): ActiveSpan {
    return new ActiveSpan({
      name,
      spanId: randomUUID(),
      parentSpanId: parent?.getSpanId(),
      clockAnchor: parent?.getClockAnchor(),
      recorder: span => this.record(span),
    })
  }
}

function resolveSinks(sinks: ForgeInstrumentationOptions['sinks'] | undefined): ForgeInstrumentationSink[] {
  if (sinks === undefined) {
    return []
  }

  return Array.isArray(sinks) ? sinks : [sinks]
}

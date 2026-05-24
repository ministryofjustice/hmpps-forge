import { createSpan } from './createSpan'
import type { ForgeSpan, ForgeSpanAttributes, ForgeSpanAttributeValue, ForgeSpanEvent } from './types'
import { ForgeSpanStatus } from './types'

export interface ActiveSpanOptions {
  name: string
  spanId: string
  parentSpanId?: string
  recorder: (span: ForgeSpan) => void
  childFactory: (name: string, parentSpanId: string) => ActiveSpan
}

export class ActiveSpan {
  private readonly name: string

  private readonly startTime: number

  private readonly spanId: string

  private readonly parentSpanId?: string

  private readonly attributes: ForgeSpanAttributes

  private readonly events: ForgeSpanEvent[]

  private readonly recorder: (span: ForgeSpan) => void

  private readonly childFactory: (name: string, parentSpanId: string) => ActiveSpan

  private status: ForgeSpanStatus

  private error?: unknown

  private recording: boolean

  constructor(options: ActiveSpanOptions) {
    this.name = options.name
    this.startTime = Date.now()
    this.spanId = options.spanId
    this.parentSpanId = options.parentSpanId
    this.attributes = {}
    this.events = []
    this.recorder = options.recorder
    this.childFactory = options.childFactory
    this.status = ForgeSpanStatus.OK
    this.recording = true
  }

  getSpanId(): string {
    return this.spanId
  }

  setAttribute(key: string, value: ForgeSpanAttributeValue): this {
    if (!this.recording) {
      return this
    }

    this.attributes[key] = value

    return this
  }

  setAttributes(attributes: ForgeSpanAttributes): this {
    if (!this.recording) {
      return this
    }

    Object.assign(this.attributes, attributes)

    return this
  }

  addEvent(name: string, attributes?: ForgeSpanAttributes): this {
    if (!this.recording) {
      return this
    }

    this.events.push({ name, timestamp: Date.now(), attributes })

    return this
  }

  recordError(error: unknown): this {
    if (!this.recording) {
      return this
    }

    this.status = ForgeSpanStatus.ERROR
    this.error = error

    return this
  }

  end(endTime?: number): void {
    if (!this.recording) {
      return
    }

    this.recording = false

    this.recorder(
      createSpan({
        name: this.name,
        startTime: this.startTime,
        endTime: endTime ?? Date.now(),
        status: this.status,
        error: this.error,
        attributes: this.attributes,
        events: this.events,
        spanId: this.spanId,
        parentSpanId: this.parentSpanId,
      }),
    )
  }

  isRecording(): boolean {
    return this.recording
  }

  traceChild(name: string): ActiveSpan {
    return this.childFactory(name, this.spanId)
  }

  traceFn<T>(fn: (span: ActiveSpan) => T): T {
    try {
      const result = fn(this)
      this.end()

      return result
    } catch (error) {
      this.recordError(error)
      this.end()
      throw error
    }
  }

  async traceAsyncFn<T>(fn: (span: ActiveSpan) => Promise<T>): Promise<T> {
    try {
      return await fn(this)
    } catch (error) {
      this.recordError(error)
      throw error
    } finally {
      this.end()
    }
  }
}

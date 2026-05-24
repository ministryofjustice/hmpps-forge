import { createSpan } from './createSpan'
import type { ForgeSpan, ForgeSpanAttributes, ForgeSpanAttributeValue, ForgeSpanEvent } from './types'
import { ForgeSpanStatus } from './types'

export class ActiveSpan {
  private name: string

  private startTime: number

  private status: ForgeSpanStatus

  private error?: unknown

  private attributes: ForgeSpanAttributes

  private events: ForgeSpanEvent[]

  private spanId?: string

  private parentSpanId?: string

  private recording: boolean

  private readonly recorder: (span: ForgeSpan) => void

  constructor(name: string, recorder: (span: ForgeSpan) => void) {
    this.name = name
    this.startTime = Date.now()
    this.status = ForgeSpanStatus.OK
    this.attributes = {}
    this.events = []
    this.recording = true
    this.recorder = recorder
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
}

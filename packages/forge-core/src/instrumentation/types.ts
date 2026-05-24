export enum ForgeSpanStatus {
  OK = 'OK',
  ERROR = 'ERROR',
}

export type ForgeSpanAttributeValue = string | number | boolean | string[] | number[] | boolean[]

export type ForgeSpanAttributes = Record<string, ForgeSpanAttributeValue>

export type HrTime = [seconds: number, nanos: number]

export interface ForgeSpanEvent {
  name: string
  timestamp: HrTime
  attributes?: ForgeSpanAttributes
}

export interface ForgeSpan {
  name: string
  startTime: HrTime
  endTime: HrTime
  duration: HrTime
  status: ForgeSpanStatus
  error?: unknown
  attributes: ForgeSpanAttributes
  events: ForgeSpanEvent[]
  spanId?: string
  parentSpanId?: string
}

export interface ForgeInstrumentationSink {
  initialize?(): void
  record(span: ForgeSpan): void | Promise<void>
}

export interface ForgeHtmlRenderDebugBridge {
  getScriptUrl(): string | undefined
}

export interface ForgeHtmlRenderDebugSink extends ForgeInstrumentationSink {
  getHtmlRenderDebugBridge(): ForgeHtmlRenderDebugBridge | undefined
}
